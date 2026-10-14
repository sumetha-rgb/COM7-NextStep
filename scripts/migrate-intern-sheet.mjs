// ย้ายแถว role=Intern จาก Users ไป INTERN โดยคัดลอกและตรวจข้อมูลก่อนลบต้นทาง
// ค่าเริ่มต้นเป็น dry run; ส่ง --apply เพื่อเขียน Google Sheet จริง
import { google } from 'googleapis';

const spreadsheetId = process.env.SHEET_ID;
const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const apply = process.argv.includes('--apply');
const HEADERS = ['id', 'email', 'fullName', 'phone', 'birthDate', 'institution', 'role', 'status', 'verifiedAt', 'createdAt', 'consentAt', 'citizenId', 'username', 'passwordHash', 'level', 'startDate', 'endDate', 'profileImageUrl', 'profileEmail', 'rulesConsentAt', 'rulesFuturePlan', 'rulesReason'];

if (!spreadsheetId || !serviceEmail || !privateKey) {
  throw new Error('กำหนด SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL และ GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ก่อน');
}

const auth = new google.auth.JWT({ email: serviceEmail, key: privateKey, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });
const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title,sheets.properties.sheetId' });
const sheetIds = new Map((meta.data.sheets || []).map((s) => [s.properties.title, s.properties.sheetId]));
const usersSheetId = sheetIds.get('Users');
if (usersSheetId === undefined) throw new Error('ไม่พบแท็บ Users; ยกเลิกโดยไม่แก้ไขข้อมูล');

const usersResult = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Users!A1:V' });
const sourceValues = usersResult.data.values || [];
const sourceHeaders = sourceValues[0] || [];
const requiredSourceColumns = HEADERS.indexOf('profileEmail') + 1;
if (sourceHeaders.length < requiredSourceColumns || sourceHeaders.length > HEADERS.length || sourceHeaders.some((header, index) => header !== HEADERS[index])) {
  throw new Error('หัวคอลัมน์ Users ไม่ตรงกับโครงสร้างที่ระบบคาดไว้; ยกเลิกโดยไม่แก้ไขข้อมูล');
}

const sourceInterns = sourceValues.slice(1).map((row, index) => ({
  rowNumber: index + 2,
  values: HEADERS.map((_, column) => String(row[column] ?? '')),
})).filter(({ values }) => values[6].trim().toLowerCase() === 'intern');

if (!sourceInterns.length) {
  if (sheetIds.has('INTERN')) {
    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'INTERN!A1:V' });
    const values = result.data.values || [];
    const headers = values[0] || [];
    if (HEADERS.some((header, index) => headers[index] !== header)) {
      throw new Error('หัวคอลัมน์ INTERN ไม่ตรงกับโครงสร้างระบบ');
    }
    const rows = values.slice(1).map((row) => HEADERS.map((_, column) => String(row[column] ?? '')));
    const internCount = rows.filter((row) => row[6].trim().toLowerCase() === 'intern').length;
    const otherRoleCount = rows.filter((row) => row.some(Boolean) && row[6].trim().toLowerCase() !== 'intern').length;
    console.log(`ตรวจสอบแล้ว: Users มี Intern 0 แถว | INTERN มี Intern ${internCount} แถว | แถว role อื่นใน INTERN ${otherRoleCount} แถว`);
  } else {
    console.log('ไม่พบแถว role=Intern ใน Users และยังไม่มีแท็บ INTERN');
  }
  process.exit(0);
}

const getKey = (values) => {
  const id = values[0].trim();
  const citizenId = values[11].replace(/[\\s-]/g, '');
  if (id) return `id:${id}`;
  if (citizenId) return `citizen:${citizenId}`;
  return null;
};
const sourceKeys = new Set();
for (const row of sourceInterns) {
  const key = getKey(row.values);
  if (!key || sourceKeys.has(key)) throw new Error('พบแถว Intern ที่ไม่มีรหัสอ้างอิงหรือมีรหัสซ้ำ; ยกเลิกโดยไม่แก้ไขข้อมูล');
  sourceKeys.add(key);
}

let destinationValues = [];
let destinationExists = sheetIds.has('INTERN');
if (destinationExists) {
  const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'INTERN!A1:V' });
  destinationValues = result.data.values || [];
  const headers = destinationValues[0] || [];
  if (HEADERS.some((header, index) => headers[index] !== header)) {
    throw new Error('หัวคอลัมน์ INTERN ไม่ตรงกับ Users; ยกเลิกเพื่อป้องกันการเขียนผิดคอลัมน์');
  }
}

const existingByKey = new Map();
for (const values of destinationValues.slice(1).map((row) => HEADERS.map((_, column) => String(row[column] ?? '')))) {
  if (values[6].trim() && values[6].trim().toLowerCase() !== 'intern') {
    throw new Error('แท็บ INTERN มีแถว role อื่นอยู่; ยกเลิกเพื่อไม่ปะปนข้อมูล');
  }
  const key = getKey(values);
  if (!key) continue;
  const prior = existingByKey.get(key);
  if (prior && JSON.stringify(prior) !== JSON.stringify(values)) {
    throw new Error('พบข้อมูล INTERN ซ้ำที่ไม่ตรงกัน; ยกเลิกเพื่อป้องกันข้อมูลสูญหาย');
  }
  existingByKey.set(key, values);
}

const toAppend = [];
for (const row of sourceInterns) {
  const prior = existingByKey.get(getKey(row.values));
  if (prior && JSON.stringify(prior) !== JSON.stringify(row.values)) {
    throw new Error('พบแถว Intern ที่มีรหัสซ้ำกับข้อมูลใน INTERN แต่เนื้อหาไม่ตรงกัน; ยกเลิกโดยไม่แก้ไขข้อมูล');
  }
  if (!prior) toAppend.push(row.values);
}

console.log(`แท็บต้นทาง: Users | แท็บปลายทาง: INTERN | พบ Intern ${sourceInterns.length} แถว | ต้องคัดลอกเพิ่ม ${toAppend.length} แถว`);
if (!apply) {
  console.log('Dry run: ไม่มีการเปลี่ยนแปลง Google Sheet; ตรวจผลแล้วค่อยเรียกสคริปต์พร้อม --apply');
  process.exit(0);
}

if (!destinationExists) {
  const created = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: 'INTERN' } } }] },
  });
  sheetIds.set('INTERN', created.data.replies[0].addSheet.properties.sheetId);
  await sheets.spreadsheets.values.update({
    spreadsheetId, range: 'INTERN!A1:V1', valueInputOption: 'RAW', requestBody: { values: [HEADERS] },
  });
  destinationValues = [HEADERS];
}

if (toAppend.length) {
  await sheets.spreadsheets.values.append({
    spreadsheetId, range: 'INTERN!A:V', valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: toAppend },
  });
}

const verifyResult = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'INTERN!A1:V' });
const verified = new Map();
for (const row of (verifyResult.data.values || []).slice(1).map((values) => HEADERS.map((_, column) => String(values[column] ?? '')))) {
  const key = getKey(row);
  if (key) verified.set(key, row);
}
for (const source of sourceInterns) {
  if (JSON.stringify(verified.get(getKey(source.values))) !== JSON.stringify(source.values)) {
    throw new Error('ตรวจข้อมูลหลังคัดลอกไม่ผ่าน; เก็บข้อมูลต้นฉบับใน Users ไว้และหยุดก่อนลบ');
  }
}

const requests = sourceInterns.map(({ rowNumber }) => ({
  deleteDimension: { range: { sheetId: usersSheetId, dimension: 'ROWS', startIndex: rowNumber - 1, endIndex: rowNumber } },
})).reverse();
await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
console.log(`ย้ายข้อมูลสำเร็จ: ${sourceInterns.length} แถวอยู่ใน INTERN และถูกนำออกจาก Users แล้ว`);
