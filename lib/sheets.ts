import { google } from 'googleapis';

// ลำดับคอลัมน์ต้องตรงกับชีตเสมอ (ห้ามสลับคอลัมน์)
export const TABS = {
  Users: ['id', 'email', 'fullName', 'phone', 'birthDate', 'institution', 'role', 'status', 'verifiedAt', 'createdAt', 'consentAt', 'citizenId', 'username', 'passwordHash', 'level', 'startDate', 'endDate', 'profileImageUrl', 'profileEmail', 'rulesConsentAt', 'rulesFuturePlan', 'rulesReason'],
  Teachers: ['id', 'email', 'fullName', 'phone', 'birthDate', 'institution', 'role', 'status', 'verifiedAt', 'createdAt', 'consentAt', 'citizenId', 'username', 'passwordHash', 'level', 'startDate', 'endDate', 'profileImageUrl', 'profileEmail', 'rulesConsentAt', 'rulesFuturePlan', 'rulesReason'],
  DVE: ['id', 'email', 'fullName', 'phone', 'birthDate', 'institution', 'role', 'status', 'verifiedAt', 'createdAt', 'consentAt', 'citizenId', 'username', 'passwordHash', 'level', 'startDate', 'endDate', 'region', 'province', 'trainingDate', 'actualStartDate', 'actualEndDate', 'profileImageUrl', 'profileEmail'],
  VerifiedUsers: ['id', 'email', 'fullName', 'phone', 'birthDate', 'institution', 'role', 'status', 'verifiedAt', 'createdAt', 'consentAt', 'citizenId', 'username', 'passwordHash', 'level', 'startDate', 'endDate', 'profileImageUrl', 'profileEmail', 'rulesConsentAt', 'rulesFuturePlan', 'rulesReason'],
  AdminUsers: ['id', 'email', 'fullName', 'username', 'passwordHash', 'status', 'createdAt', 'verifiedAt', 'profileImageUrl'],
  Institutions: ['id', 'name'],
  Otp: ['email', 'codeHash', 'expiresAt', 'attempts', 'usedAt', 'lastSentAt'],
  AuditLog: ['timestamp', 'editorEmail', 'editorRole', 'targetEmail', 'field', 'oldValue', 'newValue', 'action', 'note'],
  RateLimit: ['key', 'count', 'windowStart'],
} as const;
export type TabName = keyof typeof TABS;
export type Row = Record<string, string> & { _row: number };

let _api: ReturnType<typeof google.sheets> | null = null;
function api() {
  if (!_api) {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    _api = google.sheets({ version: 'v4', auth });
  }
  return _api;
}
const spreadsheetId = () => process.env.SHEET_ID!;
const lastCol = (tab: TabName) => String.fromCharCode(64 + TABS[tab].length);
const ensuredTabs = new Map<TabName, Promise<void>>();

async function ensureTab(tab: TabName) {
  const cached = ensuredTabs.get(tab);
  if (cached) return cached;
  const task = (async () => {
    const meta = await api().spreadsheets.get({ spreadsheetId: spreadsheetId(), fields: 'sheets.properties.title' });
    const exists = (meta.data.sheets || []).some((s) => s.properties?.title === tab);
    if (exists) return;
    await api().spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId(),
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
    await api().spreadsheets.values.update({
      spreadsheetId: spreadsheetId(),
      range: `${tab}!A1:${lastCol(tab)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [TABS[tab].slice()] },
    });
  })().catch((error) => {
    ensuredTabs.delete(tab);
    throw error;
  });
  ensuredTabs.set(tab, task);
  return task;
}

export async function readTab(tab: TabName): Promise<Row[]> {
  // Teachers เป็นชีทสมัครใหม่ จึงสร้างอัตโนมัติหากยังไม่มีในไฟล์ Google Sheets
  if (tab === 'Teachers') await ensureTab(tab);
  const res = await api().spreadsheets.values.get({ spreadsheetId: spreadsheetId(), range: `${tab}!A2:${lastCol(tab)}` });
  const cols = TABS[tab];
  return (res.data.values || []).map((v, i) => {
    const r: Record<string, string> = {};
    cols.forEach((c, j) => (r[c] = String(v[j] ?? '')));
    return { ...r, _row: i + 2, _tab: tab } as unknown as Row;
  });
}

const toValues = (tab: TabName, o: Record<string, unknown>) => TABS[tab].map((c) => String(o[c] ?? ''));

export async function appendRow(tab: TabName, data: Record<string, string>) {
  await api().spreadsheets.values.append({
    spreadsheetId: spreadsheetId(), range: `${tab}!A:A`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [toValues(tab, data)] },
  });
}
export async function appendRows(tab: TabName, list: Record<string, string>[]) {
  if (!list.length) return;
  await api().spreadsheets.values.append({
    spreadsheetId: spreadsheetId(), range: `${tab}!A:A`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: list.map((d) => toValues(tab, d)) },
  });
}
// เขียนทีละแถว: ค้นหาแถวก่อน แล้วอัปเดตเฉพาะแถวนั้น
export async function updateRow(tab: TabName, row: Row, patch: Record<string, string> = {}) {
  const merged = { ...row, ...patch };
  await api().spreadsheets.values.update({
    spreadsheetId: spreadsheetId(), range: `${tab}!A${row._row}:${lastCol(tab)}${row._row}`, valueInputOption: 'RAW',
    requestBody: { values: [toValues(tab, merged)] },
  });
}

// DVE ต้นทางใช้หัวคอลัมน์ Excel ไม่ตรงกับ TABS.DVE ภายในระบบ
// อัปเดตชื่อเล่นที่คอลัมน์ D โดยตรง เพื่อไม่เขียนทับคอลัมน์อื่นในแถวนั้น
export async function updateDveNickname(row: Row, nickname: string) {
  await api().spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `DVE!D${row._row}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[nickname]] },
  });
}
