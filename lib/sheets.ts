import { google } from 'googleapis';

// ลำดับคอลัมน์ต้องตรงกับชีตเสมอ (ห้ามสลับคอลัมน์)
export const TABS = {
  // INTERN ต้นทางใช้ layout Excel เดียวกับ DVE; aliases ภายในยังยึดตำแหน่งคอลัมน์
  INTERN: ['id', 'email', 'fullName', 'phone', 'birthDate', 'institution', 'role', 'status', 'verifiedAt', 'createdAt', 'consentAt', 'citizenId', 'username', 'passwordHash', 'level', 'startDate', 'endDate', 'region', 'province', 'trainingDate', 'actualStartDate', 'actualEndDate', 'profileImageUrl', 'profileEmail'],
  Users: ['id', 'email', 'fullName', 'phone', 'birthDate', 'institution', 'role', 'status', 'verifiedAt', 'createdAt', 'consentAt', 'citizenId', 'username', 'passwordHash', 'level', 'startDate', 'endDate', 'profileImageUrl', 'profileEmail', 'rulesConsentAt', 'rulesFuturePlan', 'rulesReason'],
  Teachers: ['id', 'email', 'fullName', 'phone', 'birthDate', 'institution', 'role', 'status', 'verifiedAt', 'createdAt', 'consentAt', 'citizenId', 'username', 'passwordHash', 'level', 'startDate', 'endDate', 'profileImageUrl', 'profileEmail', 'rulesConsentAt', 'rulesFuturePlan', 'rulesReason'],
  DVE: ['id', 'email', 'fullName', 'phone', 'birthDate', 'institution', 'role', 'status', 'verifiedAt', 'createdAt', 'consentAt', 'citizenId', 'username', 'passwordHash', 'level', 'startDate', 'endDate', 'region', 'province', 'trainingDate', 'actualStartDate', 'actualEndDate', 'profileImageUrl', 'profileEmail'],
  VerifiedUsers: ['id', 'email', 'fullName', 'phone', 'birthDate', 'institution', 'role', 'status', 'verifiedAt', 'createdAt', 'consentAt', 'citizenId', 'username', 'passwordHash', 'level', 'startDate', 'endDate', 'profileImageUrl', 'profileEmail', 'rulesConsentAt', 'rulesFuturePlan', 'rulesReason'],
  AdminUsers: ['id', 'email', 'fullName', 'username', 'passwordHash', 'status', 'createdAt', 'verifiedAt', 'profileImageUrl'],
  Institutions: ['id', 'name'],
  Otp: ['email', 'codeHash', 'expiresAt', 'attempts', 'usedAt', 'lastSentAt'],
  AuditLog: ['timestamp', 'editorEmail', 'editorRole', 'targetEmail', 'field', 'oldValue', 'newValue', 'action', 'note'],
  Rules: ['role', 'title', 'roleLabel', 'updatedAt', 'enabled', 'intro', 'itemsJson', 'futurePlanRequired', 'futurePlanOptionsJson', 'version', 'updatedBy', 'updatedAtIso'],
  RulesHistory: ['timestamp', 'role', 'version', 'editorEmail', 'snapshotJson'],
  RuleAcknowledgements: ['email', 'role', 'version', 'acknowledgedAt'],
  RateLimit: ['key', 'count', 'windowStart'],
} as const;
const INTERN_SOURCE_HEADERS = ['ลำดับ', 'รหัสบัตรประชาชน', 'ชื่อ-นามสกุล', 'ชื่อเล่น', 'วันเดือนปีเกิด', 'เบอร์ติดต่อ', 'สถานศึกษา', 'ระดับชั้น', 'สาขาวิชา', 'ที่อยู่', 'จังหวัดที่ตั้งมหาวิทยาลัย', 'ภูมิภาคที่ตั้งมหาวิทยาลัย', 'ID', 'สาขา', 'AM', 'RM', 'Group Shop', 'ภาค', 'จังหวัด', 'วันที่เข้ารับการอบรม SKH', 'วันที่เริ่มงาน', 'วันที่สิ้นสุด', 'profileImageUrl', 'profileEmail'];
const LEGACY_INTERN_HEADERS = TABS.Users;
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
      requestBody: { values: [tab === 'INTERN' ? INTERN_SOURCE_HEADERS : TABS[tab].slice()] },
    });
  })().catch((error) => {
    ensuredTabs.delete(tab);
    throw error;
  });
  ensuredTabs.set(tab, task);
  return task;
}

export async function readTab(tab: TabName): Promise<Row[]> {
  // แท็บสมัครใหม่/แยกตามบทบาทสร้างอัตโนมัติหากยังไม่มี
  if (tab === 'Teachers' || tab === 'INTERN' || tab === 'Rules' || tab === 'RulesHistory' || tab === 'RuleAcknowledgements') await ensureTab(tab);
  const range = tab === 'INTERN' ? `${tab}!A1:${lastCol(tab)}` : `${tab}!A2:${lastCol(tab)}`;
  const res = await api().spreadsheets.values.get({ spreadsheetId: spreadsheetId(), range });
  const values = res.data.values || [];
  const legacyIntern = tab === 'INTERN' && values[0]?.some((v, i) => String(v ?? '') !== INTERN_SOURCE_HEADERS[i]);
  const rows = tab === 'INTERN' ? values.slice(1) : values;
  const cols = legacyIntern ? LEGACY_INTERN_HEADERS : TABS[tab];
  return rows.map((v, i) => {
    const r: Record<string, string> = {};
    cols.forEach((c, j) => (r[c] = String(v[j] ?? '')));
    return { ...r, _row: i + 2, _tab: tab, ...(legacyIntern ? { _layout: 'legacy' } : { _layout: tab === 'INTERN' ? 'roster' : 'standard' }) } as unknown as Row;
  });
}

// อ่านหลายแท็บใน Sheets API call เดียว ใช้กับหน้ารวม Admin ที่ต้องประกอบข้อมูลหลายบทบาท
export async function readTabs(tabs: readonly TabName[]): Promise<Record<string, Row[]>> {
  await Promise.all(tabs.filter((tab) => tab === 'Teachers' || tab === 'INTERN' || tab === 'Rules' || tab === 'RulesHistory' || tab === 'RuleAcknowledgements').map(ensureTab));
  const ranges = tabs.map((tab) => `${tab}!${tab === 'INTERN' ? 'A1' : 'A2'}:${lastCol(tab)}`);
  const response = await api().spreadsheets.values.batchGet({
    spreadsheetId: spreadsheetId(),
    ranges,
  });
  const result: Record<string, Row[]> = {};
  tabs.forEach((tab, index) => {
    const allValues = response.data.valueRanges?.[index]?.values || [];
    const legacyIntern = tab === 'INTERN' && allValues[0]?.some((v, i) => String(v ?? '') !== INTERN_SOURCE_HEADERS[i]);
    const values = tab === 'INTERN' ? allValues.slice(1) : allValues;
    const columns = legacyIntern ? LEGACY_INTERN_HEADERS : TABS[tab];
    result[tab] = values.map((v, i) => {
      const row: Record<string, string> = {};
      columns.forEach((column, j) => { row[column] = String(v[j] ?? ''); });
      return { ...row, _row: i + 2, _tab: tab, ...(legacyIntern ? { _layout: 'legacy' } : { _layout: tab === 'INTERN' ? 'roster' : 'standard' }) } as unknown as Row;
    });
  });
  return result;
}

const toValues = (tab: TabName, o: Record<string, unknown>) => TABS[tab].map((c) => String(o[c] ?? ''));

export async function appendRow(tab: TabName, data: Record<string, string>) {
  if (tab === 'Rules' || tab === 'RulesHistory' || tab === 'RuleAcknowledgements') await ensureTab(tab);
  await api().spreadsheets.values.append({
    spreadsheetId: spreadsheetId(), range: `${tab}!A:A`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [toValues(tab, data)] },
  });
}
export async function appendRows(tab: TabName, list: Record<string, string>[]) {
  if (!list.length) return;
  if (tab === 'Rules' || tab === 'RulesHistory' || tab === 'RuleAcknowledgements') await ensureTab(tab);
  await api().spreadsheets.values.append({
    spreadsheetId: spreadsheetId(), range: `${tab}!A:A`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: list.map((d) => toValues(tab, d)) },
  });
}
export async function replaceTabRows(tab: TabName, list: Record<string, string>[]) {
  await ensureTab(tab);
  const end = lastCol(tab);
  if (!list.length) return;
  await api().spreadsheets.values.update({
    spreadsheetId: spreadsheetId(), range: `${tab}!A2:${end}${list.length + 1}`, valueInputOption: 'RAW',
    requestBody: { values: list.map((row) => toValues(tab, row)) },
  });
}
// เขียนทีละแถว: ค้นหาแถวก่อน แล้วอัปเดตเฉพาะแถวนั้น
export async function updateRow(tab: TabName, row: Row, patch: Record<string, string> = {}) {
  const merged = { ...row, ...patch };
  const columns = tab === 'INTERN' && row._layout === 'legacy' ? LEGACY_INTERN_HEADERS : TABS[tab];
  const endColumn = String.fromCharCode(64 + columns.length);
  await api().spreadsheets.values.update({
    spreadsheetId: spreadsheetId(), range: `${tab}!A${row._row}:${endColumn}${row._row}`, valueInputOption: 'RAW',
    requestBody: { values: [columns.map((column) => String(merged[column] ?? ''))] },
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

export async function updateInternRosterFields(row: Row, user: Record<string, unknown>) {
  const fields: Array<[string, string]> = [
    ['A', 'id'], ['B', 'citizenId'], ['C', 'fullName'], ['D', 'nickname'], ['E', 'birthDate'], ['F', 'phone'], ['G', 'institution'],
    ['H', 'level'], ['I', 'major'], ['J', 'address'], ['K', 'collegeProvince'], ['L', 'collegeRegion'],
    ['M', 'branchId'], ['N', 'branch'], ['O', 'am'], ['P', 'rm'], ['Q', 'groupShop'], ['R', 'sector'],
    ['S', 'province'], ['T', 'trainingDate'], ['U', 'startDate'], ['V', 'endDate'], ['W', 'profileImageUrl'], ['X', 'profileEmail'],
  ];
  const data = fields.flatMap(([column, key]) => user[key] === undefined ? [] : [{
    range: `INTERN!${column}${row._row}`,
    values: [[String(user[key] ?? '')]],
  }]);
  if (!data.length) return;
  await api().spreadsheets.values.batchUpdate({
    spreadsheetId: spreadsheetId(),
    requestBody: { valueInputOption: 'RAW', data: data.map(({ range, values }) => ({ range, values })) },
  });
}
