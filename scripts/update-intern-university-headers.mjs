// เปลี่ยนชื่อหัวคอลัมน์ K:L ของ INTERN โดยตรวจหัวตารางทั้งหมดก่อนเขียน
// ค่าเริ่มต้นเป็น dry run; ใช้ --apply เพื่อแก้เฉพาะข้อความหัวคอลัมน์
import { google } from 'googleapis';

const spreadsheetId = process.env.SHEET_ID;
const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const apply = process.argv.includes('--apply');
const expected = ['ลำดับ', 'รหัสบัตรประชาชน', 'ชื่อ-นามสกุล', 'ชื่อเล่น', 'วันเดือนปีเกิด', 'เบอร์ติดต่อ', 'สถานศึกษา', 'ระดับชั้น', 'สาขาวิชา', 'ที่อยู่', 'จังหวัดที่ตั้งมหาวิทยาลัย', 'ภูมิภาคที่ตั้งมหาวิทยาลัย', 'ID', 'สาขา', 'AM', 'RM', 'Group Shop', 'ภาค', 'จังหวัด', 'วันที่เข้ารับการอบรม SKH', 'วันที่เริ่มงาน', 'วันที่สิ้นสุด', 'profileImageUrl', 'profileEmail'];
const previous = [...expected];
previous[10] = 'จังหวัดที่ตั้งวิทยาลัย';
previous[11] = 'ภูมิภาคที่ตั้งวิทยาลัย';
if (!spreadsheetId || !serviceEmail || !privateKey) throw new Error('กำหนด SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL และ GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ก่อน');

const auth = new google.auth.JWT({ email: serviceEmail, key: privateKey, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });
const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'INTERN!A1:X1' });
const headers = result.data.values?.[0] || [];
if (expected.every((value, index) => headers[index] === value)) {
  console.log('หัวคอลัมน์ INTERN เป็นชื่อใหม่อยู่แล้ว; ไม่มีการเปลี่ยนแปลง');
  process.exit(0);
}
if (!previous.every((value, index) => headers[index] === value)) {
  throw new Error('หัวคอลัมน์ INTERN ไม่ตรงกับรูปแบบที่คาดไว้; ยกเลิกโดยไม่แก้ชีต');
}
console.log(`${apply ? 'กำลังเปลี่ยน' : 'dry run'}: INTERN!K1:L1 → ${expected[10]} | ${expected[11]}`);
if (!apply) {
  console.log('ยังไม่มีการแก้ Google Sheet; ใช้ --apply เพื่อเปลี่ยนเฉพาะชื่อหัวคอลัมน์');
  process.exit(0);
}
await sheets.spreadsheets.values.update({
  spreadsheetId, range: 'INTERN!K1:L1', valueInputOption: 'RAW',
  requestBody: { values: [[expected[10], expected[11]]] },
});
const verify = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'INTERN!K1:L1' });
if (verify.data.values?.[0]?.[0] !== expected[10] || verify.data.values?.[0]?.[1] !== expected[11]) {
  throw new Error('ตรวจยืนยันหัวคอลัมน์หลังเขียนไม่ผ่าน');
}
console.log('แก้และตรวจหัวคอลัมน์ INTERN แล้ว');
