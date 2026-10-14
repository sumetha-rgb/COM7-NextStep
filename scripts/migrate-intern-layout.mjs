// เปลี่ยน INTERN จาก schema ภายในเดิมเป็น layout Excel แบบ DVE
// ค่าเริ่มต้นเป็น dry run; ใช้ --apply หลังตรวจจำนวนและผลลัพธ์แล้ว
import { google } from 'googleapis';

const spreadsheetId = process.env.SHEET_ID;
const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const apply = process.argv.includes('--apply');
const LEGACY = ['id', 'email', 'fullName', 'phone', 'birthDate', 'institution', 'role', 'status', 'verifiedAt', 'createdAt', 'consentAt', 'citizenId', 'username', 'passwordHash', 'level', 'startDate', 'endDate', 'profileImageUrl', 'profileEmail', 'rulesConsentAt', 'rulesFuturePlan', 'rulesReason'];
const ROSTER = ['ลำดับ', 'รหัสบัตรประชาชน', 'ชื่อ-นามสกุล', 'ชื่อเล่น', 'วันเดือนปีเกิด', 'เบอร์ติดต่อ', 'สถานศึกษา', 'ระดับชั้น', 'สาขาวิชา', 'ที่อยู่', 'จังหวัดที่ตั้งมหาวิทยาลัย', 'ภูมิภาคที่ตั้งมหาวิทยาลัย', 'ID', 'สาขา', 'AM', 'RM', 'Group Shop', 'ภาค', 'จังหวัด', 'วันที่เข้ารับการอบรม SKH', 'วันที่เริ่มงาน', 'วันที่สิ้นสุด', 'profileImageUrl', 'profileEmail'];
const VERIFIED = ['id', 'email', 'fullName', 'phone', 'birthDate', 'institution', 'role', 'status', 'verifiedAt', 'createdAt', 'consentAt', 'citizenId', 'username', 'passwordHash', 'level', 'startDate', 'endDate', 'profileImageUrl', 'profileEmail', 'rulesConsentAt', 'rulesFuturePlan', 'rulesReason'];
if (!spreadsheetId || !serviceEmail || !privateKey) throw new Error('กำหนด SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL และ GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ก่อน');

const auth = new google.auth.JWT({ email: serviceEmail, key: privateKey, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });
const [meta, internResult, verifiedResult] = await Promise.all([
  sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title,sheets.properties.sheetId' }),
  sheets.spreadsheets.values.get({ spreadsheetId, range: 'INTERN!A1:X' }),
  sheets.spreadsheets.values.get({ spreadsheetId, range: 'VerifiedUsers!A1:V' }),
]);
const internValues = internResult.data.values || [];
const verifiedValues = verifiedResult.data.values || [];
const header = internValues[0] || [];
if (header.length === ROSTER.length && ROSTER.every((value, index) => header[index] === value)) {
  console.log('INTERN ใช้หัวคอลัมน์แบบ DVE อยู่แล้ว; ไม่มีการเปลี่ยนแปลง');
  process.exit(0);
}
if (header.length !== LEGACY.length || !LEGACY.every((value, index) => header[index] === value)) {
  throw new Error('หัวคอลัมน์ INTERN ไม่ตรงกับ schema เดิมหรือแบบ DVE; ยกเลิกเพื่อป้องกันการแปลงข้อมูลผิด');
}
const verifiedHeader = verifiedValues[0] || [];
if (verifiedHeader.length < 19 || verifiedHeader.length > VERIFIED.length || !verifiedHeader.every((value, index) => value === VERIFIED[index] || (index === 0 && value === ''))) {
  throw new Error(`หัวคอลัมน์ VerifiedUsers ไม่ตรงกับระบบ (${verifiedHeader.length} คอลัมน์); ยกเลิกโดยไม่แก้ข้อมูล`);
}
const extendVerifiedHeader = verifiedHeader.length < VERIFIED.length;

const source = internValues.slice(1).map((row, index) => ({
  rowNumber: index + 2,
  value: LEGACY.map((_, column) => String(row[column] ?? '')),
})).filter(({ value }) => value.some(Boolean));
if (source.some(({ value }) => value[6].trim().toLowerCase() !== 'intern')) {
  throw new Error('พบ role ที่ไม่ใช่ Intern ในแท็บ INTERN; ยกเลิกเพื่อไม่แปลงข้อมูลผิดบทบาท');
}
const citizenKey = (id) => String(id || '').replace(/[\s-]/g, '');
const verifiedRows = verifiedValues.slice(1).map((row) => VERIFIED.map((_, index) => String(row[index] ?? '')));
const existingKeys = new Set(verifiedRows.map((row) => citizenKey(row[11])).filter(Boolean));
const existingEmails = new Set(verifiedRows.map((row) => String(row[18] || row[1] || '').trim().toLowerCase()).filter(Boolean));
const toVerified = [];
const rosterRows = source.map(({ value }, index) => {
  const [id, email, fullName, phone, birthDate, institution, role, status, verifiedAt, createdAt, consentAt, citizenId, username, passwordHash, level, startDate, endDate, profileImageUrl, profileEmail, rulesConsentAt, rulesFuturePlan, rulesReason] = value;
  if (['ยืนยันแล้ว', 'ยืนยันแล้วแก้ไข', 'ปฏิเสธ'].includes(status) || consentAt) {
    const key = citizenKey(citizenId);
    const normalizedEmail = String(profileEmail || email || '').trim().toLowerCase();
    if ((!key || !existingKeys.has(key)) && (!normalizedEmail || !existingEmails.has(normalizedEmail))) {
      toVerified.push([id || `verified-migrated-${index + 1}`, email, fullName, phone, birthDate, institution, 'Intern', status || 'ยืนยันแล้ว', verifiedAt, createdAt, consentAt, citizenId, username, passwordHash, level, startDate, endDate, profileImageUrl, profileEmail || email, rulesConsentAt, rulesFuturePlan, rulesReason]);
      if (key) existingKeys.add(key);
      if (normalizedEmail) existingEmails.add(normalizedEmail);
    }
  }
  return [id || String(index + 1), citizenId, fullName, '', birthDate, phone, institution, level, '', '', '', '', '', '', '', '', '', '', '', '', startDate, endDate, profileImageUrl, profileEmail || email];
});
const ids = new Map((meta.data.sheets || []).map((item) => [item.properties.title, item.properties.sheetId]));
const sourceSheetId = ids.get('INTERN');
if (sourceSheetId === undefined) throw new Error('ไม่พบแท็บ INTERN');
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const backupName = `INTERN_BACKUP_${stamp}`;
const verifiedStartRow = verifiedValues.length + 1;
console.log(`สรุป ${apply ? 'เตรียมดำเนินการ' : 'dry run'}: INTERN ${source.length} แถว | ย้ายข้อมูลที่ยืนยันแล้วเข้า VerifiedUsers ${toVerified.length} แถว | ${extendVerifiedHeader ? 'ขยายหัวคอลัมน์ VerifiedUsers เป็น 22 ช่อง | ' : ''}สำรองเป็น ${backupName}`);
if (!apply) {
  console.log('ยังไม่มีการแก้ Google Sheet; ใช้ --apply เพื่อสำรองและแปลงข้อมูล');
  process.exit(0);
}

await sheets.spreadsheets.batchUpdate({
  spreadsheetId,
  requestBody: { requests: [{ duplicateSheet: { sourceSheetId, newSheetName: backupName } }] },
});
const updates = [{ range: `INTERN!A1:X${Math.max(1, rosterRows.length + 1)}`, values: [ROSTER, ...rosterRows] }];
if (extendVerifiedHeader) updates.push({ range: 'VerifiedUsers!A1:V1', values: [VERIFIED] });
if (toVerified.length) updates.push({ range: `VerifiedUsers!A${verifiedStartRow}:V${verifiedStartRow + toVerified.length - 1}`, values: toVerified });
await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'RAW', data: updates } });

const [checkIntern, checkVerified] = await Promise.all([
  sheets.spreadsheets.values.get({ spreadsheetId, range: 'INTERN!A1:X' }),
  sheets.spreadsheets.values.get({ spreadsheetId, range: 'VerifiedUsers!A1:V' }),
]);
const checkHeader = checkIntern.data.values?.[0] || [];
const checkInternCount = (checkIntern.data.values || []).slice(1).filter((row) => row.some(Boolean)).length;
const checkVerifiedCount = (checkVerified.data.values || []).slice(1).filter((row) => row[6] === 'Intern').length;
if (!ROSTER.every((value, index) => checkHeader[index] === value) || checkInternCount !== rosterRows.length) {
  throw new Error('ตรวจยืนยันผลหลังแปลงไม่ผ่าน; เก็บสำเนาข้อมูลเดิมไว้ในแท็บสำรองแล้ว');
}
console.log(`เสร็จและตรวจแล้ว: INTERN ${checkInternCount} แถว | VerifiedUsers มี Intern ${checkVerifiedCount} แถว | สำเนาเดิม ${backupName}`);
