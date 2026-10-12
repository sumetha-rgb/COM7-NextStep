// ไฟล์กำหนดสิทธิ์ที่เดียว: role -> เส้นทางที่เข้าได้, role -> หน้าแรกหลัง login
export const ROLES = ['Intern', 'DVE', 'Teacher', 'Admin'] as const;
export type Role = (typeof ROLES)[number];
export const STATUSES = ['รอตรวจสอบ', 'ยืนยันแล้ว', 'ปฏิเสธ'] as const;
export type Status = (typeof STATUSES)[number];

export const ACCESS: Record<Role, string[]> = {
  Intern: ['/rules', '/confirm', '/api/me', '/api/profile'],
  DVE: ['/rules', '/confirm', '/api/me', '/api/profile'],
  Teacher: ['/rules', '/confirm', '/api/me', '/api/profile'],
  Admin: ['/admin', '/api/admin'],
};

export const HOME: Record<Role, string> = {
  Intern: '/rules', DVE: '/rules', Teacher: '/rules', Admin: '/admin',
};

export const PUBLIC_PATHS = ['/', '/login', '/admin/login', '/admin/register', '/api/auth', '/api/otp/request', '/api/admin/register', '/api/institutions', '/demo', '/confirm'];

const under = (p: string, base: string) => p === base || p.startsWith(base + '/');
export const isPublic = (p: string) => PUBLIC_PATHS.some((b) => (b === '/' ? p === '/' : under(p, b)));
export const canAccess = (role: Role, p: string) => ACCESS[role].some((b) => under(p, b));
export const isRole = (v: unknown): v is Role => ROLES.includes(v as Role);
export const isStatus = (v: unknown): v is Status => STATUSES.includes(v as Status);
