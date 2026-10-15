import { unstable_cache, revalidateTag } from 'next/cache';
import { appendRow, readTab, readTabs, updateInternRosterFields, updateRow, type Row } from './sheets';
import { normEmail, normName, normPersonName } from './validators';
import type { Role } from './permissions';

export type UserRow = Row;
// อ่าน INTERN ก่อน Users เพื่อให้ข้อมูล Intern หลังย้ายใช้เป็นข้อมูลหลัก
// ยังคงอ่าน Users ไว้รองรับ role อื่นและข้อมูลเดิมที่ยังไม่ได้แยก
const USER_TABS = ['INTERN', 'Users', 'Teachers', 'DVE'] as const;
async function readAllUsers() {
  const rows = await readTabs(USER_TABS);
  return USER_TABS.flatMap((tab) => rows[tab] || []);
}
async function readUserLookupTabs() {
  const rows = await readTabs([...USER_TABS, 'VerifiedUsers']);
  return {
    users: USER_TABS.flatMap((tab) => rows[tab] || []),
    verified: rows.VerifiedUsers || [],
  };
}
async function readVerifiedUsers() { return (await readTabs(['VerifiedUsers'])).VerifiedUsers || []; }

// ลดการอ่าน Google Sheets ซ้ำทุกคำขอในช่วงกิจกรรมที่มีผู้ใช้เข้าพร้อมกัน
// ข้อมูลต้นทางจะถูก refresh สูงสุดทุก 30 วินาที และรวมคำขอที่เข้าพร้อมกันเป็นครั้งเดียว
const LOOKUP_CACHE_MS = 30_000;
const ADMIN_CACHE_MS = 60_000;
let lookupCache: { users: UserRow[]; verified: UserRow[]; expiresAt: number } | null = null;
let lookupPromise: Promise<{ users: UserRow[]; verified: UserRow[] }> | null = null;
const adminCache = new Map<string, { row: UserRow | null; expiresAt: number }>();
async function readLookupData() {
  if (lookupCache && lookupCache.expiresAt > Date.now()) return lookupCache;
  if (!lookupPromise) {
    lookupPromise = readUserLookupTabs().then((data) => {
      lookupCache = { ...data, expiresAt: Date.now() + LOOKUP_CACHE_MS };
      return data;
    }).finally(() => { lookupPromise = null; });
  }
  const data = await lookupPromise;
  return { ...data, expiresAt: Date.now() + LOOKUP_CACHE_MS };
}
export function invalidateLookupCache() { lookupCache = null; }
export function normaliseDveRow(u: UserRow): UserRow {
  // ข้อมูล DVE รุ่นเก่าถูกนำเข้าโดยใช้คอลัมน์ Excel เดิม ทำให้ email = เลขบัตร
  // และคอลัมน์ถัด ๆ ไปเลื่อนตำแหน่ง จัดรูปเฉพาะตอนอ่านแสดงผล โดยไม่เขียนทับข้อมูลต้นฉบับ
  if (u._tab === 'INTERN' && u._layout === 'legacy') return u;
  const isInternRoster = u._tab === 'INTERN' && u._layout === 'roster';
  const looksLikeImportedExcel = (u._tab === 'DVE' || isInternRoster) && /^\d[\d\s-]{10,}$/.test(String(u.email || '')) && !['Intern', 'DVE', 'Teacher', 'Admin'].includes(String(u.role || ''));
  if (!looksLikeImportedExcel) return u;
  return {
    ...u,
    _normalizedRoster: true,
    _sourceEmail: u.email,
    email: u.profileEmail || '',
    citizenId: u.email,
    phone: u.institution || u.phone,
    institution: u.role,
    role: isInternRoster ? 'Intern' : 'DVE',
    status: isInternRoster ? 'รอตรวจสอบ' : ['รอตรวจสอบ', 'ยืนยันแล้ว', 'ปฏิเสธ'].includes(u.status) ? u.status : 'รอตรวจสอบ',
    level: isInternRoster ? u.status : 'ปวส.',
    startDate: u.actualStartDate || u.startDate,
    endDate: u.actualEndDate || u.endDate,
    nickname: u.phone,
    major: u.verifiedAt,
    address: u.createdAt,
    collegeProvince: u.consentAt,
    collegeRegion: u.citizenId,
    branchId: u.username,
    branch: u.passwordHash,
    am: u.level,
    rm: u.startDate,
    groupShop: u.endDate,
    sector: u.region,
    province: u.province,
    trainingDate: u.trainingDate,
  } as unknown as UserRow;
}
export async function findUserByEmail(email: string, fresh = false): Promise<UserRow | null> {
  const internalIdentity = /^citizen:(\d{13})$/.exec(String(email || '').trim());
  if (internalIdentity) {
    const data = fresh
      ? await readUserLookupTabs()
      : await readLookupData();
    const id = internalIdentity[1];
    const matchesId = (raw: UserRow) => {
      const user = normaliseDveRow(raw);
      return String(user.citizenId || '').replace(/\D/g, '') === id || (raw._tab === 'DVE' && String(raw.email || '').replace(/\D/g, '') === id);
    };
    const verifiedUser = data.verified.find(matchesId);
    if (verifiedUser) {
      const source = data.users.find((u) => ['DVE', 'INTERN'].includes(String(u._tab)) && matchesId(u));
      const original = source ? normaliseDveRow(source) : null;
      return {
        ...verifiedUser,
        email: verifiedUser.email || original?.email || '',
        profileEmail: verifiedUser.profileEmail || original?.profileEmail || '',
        nickname: verifiedUser.nickname || original?.nickname || '',
        profileImageUrl: verifiedUser.profileImageUrl || original?.profileImageUrl || '',
      } as unknown as UserRow;
    }
    return data.users.find(matchesId) ?? null;
  }
  const e = normEmail(email);
  const data = fresh
    ? await readUserLookupTabs()
    : await readLookupData();
  const { users, verified } = data;
  const verifiedUser = verified.find((u) => normEmail(u.email) === e || normEmail(u.profileEmail) === e);
  if (verifiedUser) {
    // VerifiedUsers เป็นข้อมูลสรุป จึงเติมชื่อเล่น/รูปจากข้อมูล DVE ต้นฉบับ
    // ในกรณีที่แถวเดิมมีข้อมูล แต่ตอนยืนยันไม่ได้คัดลอกฟิลด์นี้มา
    const source = users.find((u) => ['DVE', 'INTERN'].includes(String(u._tab)) && (
      normEmail(u.profileEmail) === e ||
      String(u.email || '').replace(/[\s-]/g, '') === String(verifiedUser.citizenId || '').replace(/[\s-]/g, '')
    ));
    if (source) {
      const original = normaliseDveRow(source);
      return {
        ...verifiedUser,
        nickname: verifiedUser.nickname || original.nickname || '',
        profileImageUrl: verifiedUser.profileImageUrl || original.profileImageUrl || '',
      } as unknown as UserRow;
    }
    return verifiedUser;
  }
  return users.find((u) => normEmail(u.email) === e || normEmail(u.profileEmail) === e) ?? null;
}
export async function findUserByCitizenId(citizenId: string): Promise<UserRow | null> {
  const id = String(citizenId ?? '').replace(/[-\s]/g, '');
  const match = (u: UserRow) => {
    // INTERN/DVE roster rows are mapped by source column order on read. Normalize
    // them before comparing: in an INTERN roster the raw `citizenId` alias is
    // the university-region column, while the actual citizen ID is in `email`.
    const normalized = normaliseDveRow(u);
    return String(normalized.citizenId ?? '').replace(/[-\s]/g, '') === id
      || (u._tab === 'DVE' && String(u.email ?? '').replace(/[-\s]/g, '') === id);
  };
  const { users, verified } = await readLookupData();
  // Preferir a origem DVE: a linha de VerifiedUsers pode não conter profileEmail.
  // Assim a rota que vincula o e-mail após validar o ID atualiza a linha correta.
  return users.find((u) => u._tab === 'DVE' && match(u)) ?? verified.find(match) ?? users.find(match) ?? null;
}
function accountKey(raw: UserRow): string {
  const user = normaliseDveRow(raw);
  const citizenId = String(user.citizenId || '').replace(/\D/g, '');
  if (citizenId.length === 13) return `citizen:${citizenId}`;
  if (user.id) return `${user.role}:${user.id}`;
  return `${raw._tab || 'unknown'}:${raw._row || ''}`;
}
export async function emailUsedByAnotherAccount(email: string, owner?: UserRow | { citizenId?: string; id?: string; role?: string; _tab?: string; _row?: number }): Promise<boolean> {
  const target = normEmail(email);
  if (!target) return false;
  const [users, verified, admins] = await Promise.all([readAllUsers(), readVerifiedUsers(), readTab('AdminUsers')]);
  const ownerKey = owner ? accountKey(owner as UserRow) : '';
  for (const raw of [...users, ...verified]) {
    const user = normaliseDveRow(raw);
    if (normEmail(user.email) !== target && normEmail(user.profileEmail) !== target) continue;
    if (!ownerKey || accountKey(raw) !== ownerKey) return true;
  }
  for (const admin of admins) {
    if (normEmail(admin.email) === target && (!ownerKey || accountKey(admin) !== ownerKey)) return true;
  }
  return false;
}
export async function findUniqueStudentByCitizenLast5(last5: string): Promise<UserRow | null> {
  const suffix = String(last5 ?? '').replace(/\D/g, '');
  if (suffix.length !== 5) return null;
  const { users, verified } = await readLookupData();
  const byCitizenId = new Map<string, UserRow>();
  // VerifiedUsers comes last so its current status wins, while the source row
  // can still supply an email when the verified snapshot does not have one.
  for (const raw of [...users, ...verified]) {
    const user = normaliseDveRow(raw);
    const citizenId = String(user.citizenId || '').replace(/\D/g, '');
    if (citizenId.length !== 13 || !citizenId.endsWith(suffix) || !['Intern', 'DVE'].includes(String(user.role)) || user.status === 'ปฏิเสธ') continue;
    const previous = byCitizenId.get(citizenId);
    byCitizenId.set(citizenId, previous ? ({
      ...user,
      email: user.email || previous.email,
      profileEmail: user.profileEmail || previous.profileEmail,
    } as unknown as UserRow) : user);
  }
  return byCitizenId.size === 1 ? [...byCitizenId.values()][0] : null;
}
export async function findConfirmedStudentByNameAndLast5(firstName: string, lastName: string, last5: string): Promise<UserRow | null> {
  const comparableName = (value: unknown) => normPersonName(value).replace(/^(นางสาว|เด็กชาย|เด็กหญิง|อาจารย์|นาย|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.)\s*/i, '');
  const fullName = comparableName(`${firstName} ${lastName}`);
  const suffix = String(last5 ?? '').replace(/\D/g, '');
  if (!firstName.trim() || !lastName.trim() || suffix.length !== 5) return null;
  const { users, verified } = await readLookupData();
  const matches = new Map<string, UserRow>();
  for (const raw of [...users, ...verified]) {
    const user = normaliseDveRow(raw);
    const citizenId = String(user.citizenId || '').replace(/\D/g, '');
    if (citizenId.length !== 13 || !citizenId.endsWith(suffix) || !['Intern', 'DVE'].includes(String(user.role))) continue;
    if (!['ยืนยันแล้ว', 'ยืนยันแล้วแก้ไข'].includes(user.status) || !user.consentAt) continue;
    if (comparableName(user.fullName) !== fullName) continue;
    const previous = matches.get(citizenId);
    matches.set(citizenId, previous ? ({
      ...user,
      email: user.email || previous.email,
      profileEmail: user.profileEmail || previous.profileEmail,
    } as unknown as UserRow) : user);
  }
  return matches.size === 1 ? [...matches.values()][0] : null;
}
export async function findVerifiedByEmail(email: string) { const e = normEmail(email); return (await readVerifiedUsers()).find((u) => normEmail(u.email) === e || normEmail(u.profileEmail) === e) ?? null; }
export async function findVerifiedByCitizenId(citizenId: string) { const id = String(citizenId ?? '').replace(/[-\s]/g, ''); return (await readVerifiedUsers()).find((u) => String(u.citizenId ?? '').replace(/[-\s]/g, '') === id) ?? null; }
export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const u = String(username ?? '').trim().toLowerCase();
  return (await readAllUsers()).find((r) => String(r.username ?? '').trim().toLowerCase() === u) ?? null;
}
export async function findAdminByEmail(email: string): Promise<UserRow | null> {
  const e = normEmail(email);
  const cached = adminCache.get(e);
  if (cached && cached.expiresAt > Date.now()) return cached.row;
  const row = (await readTab('AdminUsers')).find((u) => normEmail(u.email) === e) ?? null;
  adminCache.set(e, { row, expiresAt: Date.now() + ADMIN_CACHE_MS });
  return row;
}
export async function findAdminByUsername(username: string): Promise<UserRow | null> {
  const u = String(username ?? '').trim().toLowerCase();
  return (await readTab('AdminUsers')).find((r) => String(r.username ?? '').trim().toLowerCase() === u) ?? null;
}
export async function saveUser(u: UserRow) {
  if ((u._tab === 'INTERN' || u._tab === 'DVE') && u._normalizedRoster) {
    if (u._tab === 'INTERN') await updateInternRosterFields(u, u as unknown as Record<string, unknown>);
    const snapshot = {
        id: u.id || `verified-${Date.now()}`, email: u.email || u.profileEmail || '', fullName: u.fullName || '',
        phone: u.phone || '', birthDate: u.birthDate || '', institution: u.institution || '', role: u.role || 'Intern',
        status: u.status || 'รอตรวจสอบ', verifiedAt: u.verifiedAt || '', createdAt: u.createdAt || '', consentAt: u.consentAt || '',
        citizenId: u.citizenId || '', username: u.username || '', passwordHash: u.passwordHash || '', level: u.level || '',
        startDate: u.startDate || '', endDate: u.endDate || '', profileImageUrl: u.profileImageUrl || '',
        profileEmail: u.profileEmail || u.email || '', rulesConsentAt: u.rulesConsentAt || '',
        rulesFuturePlan: u.rulesFuturePlan || '', rulesReason: u.rulesReason || '',
    };
    const existing = await findVerifiedByCitizenId(snapshot.citizenId);
    if (existing) await updateRow('VerifiedUsers', existing, snapshot);
    else await appendRow('VerifiedUsers', snapshot);
  } else {
    await updateRow(u._tab === 'VerifiedUsers' ? 'VerifiedUsers' : u._tab === 'DVE' ? 'DVE' : u._tab === 'Teachers' ? 'Teachers' : u._tab === 'INTERN' ? 'INTERN' : 'Users', u);
  }
  invalidateLookupCache();
  revalidateTag('users');
}

// Bind the email used for the five-digit fallback to the existing student
// account without creating a VerifiedUsers snapshot for an unconfirmed user.
export async function saveStudentEmailByCitizenId(citizenId: string, email: string) {
  const id = String(citizenId ?? '').replace(/\D/g, '');
  const normalizedEmail = normEmail(email);
  const { users, verified } = await readUserLookupTabs();
  const matchesId = (raw: UserRow) => String(normaliseDveRow(raw).citizenId ?? '').replace(/\D/g, '') === id;
  const source = users.find((raw) => ['INTERN', 'DVE'].includes(String(raw._tab)) && matchesId(raw));
  const verifiedUser = verified.find(matchesId);

  if (!source && !verifiedUser) throw new Error('Student account not found while saving email');
  if (source?._tab === 'INTERN' && source._layout === 'roster') {
    await updateInternRosterFields(source, { profileEmail: normalizedEmail });
  } else if (source) {
    await updateRow(source._tab === 'DVE' ? 'DVE' : 'INTERN', source, { profileEmail: normalizedEmail });
  }
  if (verifiedUser) {
    await updateRow('VerifiedUsers', verifiedUser, { email: normalizedEmail, profileEmail: normalizedEmail });
  }
  invalidateLookupCache();
  revalidateTag('users');
}

// แคช 45 วินาที สำหรับหน้า Admin (ลดโควตา Sheets API)
export const listUsersCached = unstable_cache(
  async () => {
    const seen = new Set<string>();
    const lookup = await readLookupData();
    const base = lookup.users.map(normaliseDveRow);
    const verified = lookup.verified;
    const verifiedKeys = new Set(verified.map((u) => normEmail(u.email) || String(u.citizenId || '').replace(/[-\s]/g, '')));
    const visibleBase = base.filter((u) => !verifiedKeys.has(normEmail(u.email) || String(u.citizenId || '').replace(/[-\s]/g, '')));
    return [...visibleBase, ...verified].filter((u) => {
      const e = normEmail(String(u._sourceEmail || u.email || u.profileEmail || u.id));
      if (!e || seen.has(e)) return false; seen.add(e); return true;
    });
  },
  ['users-all'], { revalidate: 45, tags: ['users'] },
);
export const listInstitutionsCached = unstable_cache(
  async () => {
    const [institutionRows, userRows, verifiedRows] = await Promise.all([
      readTab('Institutions'),
      readAllUsers(),
      readVerifiedUsers(),
    ]);
    const names = new Set<string>();
    institutionRows.forEach((row) => { if (row.name?.trim()) names.add(row.name.trim()); });
    [...userRows.map(normaliseDveRow), ...verifiedRows].forEach((row) => {
      if (row.institution?.trim()) names.add(row.institution.trim());
    });
    return [...names]
      .filter((name) => !name.includes('มหาวิทยาลัยตัวอย่าง') && !name.includes('บริษัท'))
      .sort((a, b) => a.localeCompare(b, 'th'));
  },
  ['institutions'], { revalidate: 60, tags: ['institutions'] },
);

export type Portal = 'user' | 'admin';
export type Mode = 'email' | 'institution' | 'student' | 'teacher';
// ผู้มีสิทธิ์ขอ/ใช้ OTP ในพอร์ทัลนั้นๆ (ตรวจฝั่งเซิร์ฟเวอร์ทั้งตอนขอและตอนยืนยัน)
export function eligible(u: UserRow | null, portal: Portal, mode: Mode = 'email', input?: { fullName?: string; institution?: string; email?: string; citizenId?: string }): u is UserRow {
  if (!u || u.status === 'ปฏิเสธ') return false;
  const isAdmin = (u.role as Role) === 'Admin';
  if (portal === 'admin' ? !isAdmin : isAdmin) return false;
  if (!['Intern', 'DVE', 'Teacher', 'Admin'].includes(u.role)) return false;
  if (mode === 'student') {
    const sameId = String(u.citizenId ?? '').replace(/[-\s]/g, '') === String(input?.citizenId ?? '').replace(/[-\s]/g, '');
    const studentRole = u.role === 'Intern' || u.role === 'DVE';
    // ตรวจสอบเลขบัตรประชาชนและชื่อกับ Backend เท่านั้น
    return studentRole && sameId;
  }
  if (mode === 'institution' || mode === 'teacher') {
    if (portal !== 'user') return false;
    return u.role === 'Teacher' && normPersonName(u.fullName) === normPersonName(input?.fullName) && normName(u.institution) === normName(input?.institution);
  }
  return true;
}
