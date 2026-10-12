// สร้างแท็บ + หัวคอลัมน์ + ตั้งคอลัมน์เป็น Text + แถวทดสอบ  |  รัน: npm run seed
import { google } from 'googleapis';

const TABS = {
  Users: ['id', 'email', 'fullName', 'phone', 'birthDate', 'institution', 'role', 'status', 'verifiedAt', 'createdAt', 'consentAt', 'citizenId', 'username', 'passwordHash', 'level', 'startDate', 'endDate', 'profileImageUrl', 'profileEmail', 'rulesConsentAt', 'rulesFuturePlan', 'rulesReason'],
  Teachers: ['id', 'email', 'fullName', 'phone', 'birthDate', 'institution', 'role', 'status', 'verifiedAt', 'createdAt', 'consentAt', 'citizenId', 'username', 'passwordHash', 'level', 'startDate', 'endDate', 'profileImageUrl', 'profileEmail', 'rulesConsentAt', 'rulesFuturePlan', 'rulesReason'],
  // หัวคอลัมน์ที่แสดงในชีท DVE ใช้ตามแบบ Excel จริง 22 คอลัมน์
  DVE: ['ลำดับ', 'รหัสบัตรประชาชน', 'ชื่อ-นามสกุล', 'ชื่อเล่น', 'วันเดือนปีเกิด', 'เบอร์ติดต่อ', 'สถานศึกษา', 'ระดับชั้น', 'สาขาวิชา', 'ที่อยู่', 'จังหวัดที่ตั้งวิทยาลัย', 'ภูมิภาคที่ตั้งวิทยาลัย', 'ID', 'สาขา', 'AM', 'RM', 'Group Shop', 'ภาค', 'จังหวัด', 'วันที่เข้ารับการอบรม SKH', 'วันที่เริ่มงาน', 'วันที่สิ้นสุด'],
  VerifiedUsers: ['id', 'email', 'fullName', 'phone', 'birthDate', 'institution', 'role', 'status', 'verifiedAt', 'createdAt', 'consentAt', 'citizenId', 'username', 'passwordHash', 'level', 'startDate', 'endDate', 'profileImageUrl', 'profileEmail', 'rulesConsentAt', 'rulesFuturePlan', 'rulesReason'],
  AdminUsers: ['id', 'email', 'fullName', 'username', 'passwordHash', 'status', 'createdAt', 'verifiedAt', 'profileImageUrl'],
  Institutions: ['id', 'name'],
  Otp: ['email', 'codeHash', 'expiresAt', 'attempts', 'usedAt', 'lastSentAt'],
  AuditLog: ['timestamp', 'editorEmail', 'editorRole', 'targetEmail', 'field', 'oldValue', 'newValue', 'action', 'note'],
  RateLimit: ['key', 'count', 'windowStart'],
};
const now = new Date().toISOString();
const SAMPLE = {
  Institutions: [['1', 'มหาวิทยาลัยตัวอย่าง'], ['2', 'วิทยาลัยเทคนิคตัวอย่าง']],
  Users: [
    ['u1', 'intern@example.com', 'สมชาย ฝึกงาน', '0811111111', '2003-05-10', 'มหาวิทยาลัยตัวอย่าง', 'Intern', 'รอตรวจสอบ', '', now, '', '1100000000001', '', '', 'ปวช.', '', ''],
    ['u2', 'dve@example.com', 'สมหญิง ทวิภาคี', '0822222222', '2006-03-21', 'วิทยาลัยเทคนิคตัวอย่าง', 'DVE', 'รอตรวจสอบ', '', now, '', '1100000000002', '', '', 'ปวส.', '', ''],
    ['u3', 'teacher@example.com', 'อาจารย์ ใจดี', '0833333333', '1985-11-02', 'มหาวิทยาลัยตัวอย่าง', 'Teacher', 'รอตรวจสอบ', '', now, '', '', '', '', '', '', ''],
    ['u4', 'admin@example.com', 'ผู้ดูแล ระบบ', '0844444444', '1990-01-15', 'บริษัท', 'Admin', 'ยืนยันแล้ว', now, now, now, '', '', '', '', '', ''],
  ],
};

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
const spreadsheetId = process.env.SHEET_ID;

const meta = await sheets.spreadsheets.get({ spreadsheetId });
const existing = Object.fromEntries(meta.data.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
const add = Object.keys(TABS).filter((t) => !(t in existing)).map((title) => ({ addSheet: { properties: { title } } }));
if (add.length) {
  const r = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: add } });
  r.data.replies.forEach((x) => (existing[x.addSheet.properties.title] = x.addSheet.properties.sheetId));
}
// ตั้งทั้งแท็บเป็น Plain text กันเบอร์โทร 0 นำหน้าหาย / วันที่ถูกแปลง
await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: Object.keys(TABS).map((t) => ({
  repeatCell: { range: { sheetId: existing[t] }, cell: { userEnteredFormat: { numberFormat: { type: 'TEXT' } } }, fields: 'userEnteredFormat.numberFormat' } })) } });

for (const [tab, headers] of Object.entries(TABS)) {
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `${tab}!A1`, valueInputOption: 'RAW', requestBody: { values: [headers] } });
  const cur = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A2:A2` });
  if (SAMPLE[tab] && !(cur.data.values || []).length) {
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `${tab}!A2`, valueInputOption: 'RAW', requestBody: { values: SAMPLE[tab] } });
  }
  console.log('OK', tab);
}
console.log('เสร็จแล้ว: เปลี่ยนอีเมลตัวอย่างเป็นอีเมลจริงที่รับ OTP ได้ก่อนทดสอบ');
