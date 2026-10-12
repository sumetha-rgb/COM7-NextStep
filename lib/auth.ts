import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getServerSession } from 'next-auth';
import { verifyOtp } from './otp';
import { eligible, emailUsedByAnotherAccount, findConfirmedStudentByNameAndLast5, findUniqueStudentByCitizenLast5, findUserByCitizenId, findUserByEmail, findAdminByUsername, invalidateLookupCache, normaliseDveRow, saveUser, type Portal } from './users';
import { verifyPassword } from './password';
import { isRole, type Role } from './permissions';
import { normEmail, normPersonName } from './validators';
import { DEMO_USERS, isDemo } from './demo';
import { rateLimit } from './ratelimit';

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      id: 'admin-password', name: 'admin-password', credentials: { username: {}, password: {} },
      async authorize(c) {
        const user = await findAdminByUsername(String(c?.username ?? ''));
        // แท็บ AdminUsers แยกจาก Users อยู่แล้ว จึงถือว่าทุกแถวในแท็บนี้เป็น Admin
        if (!user || user.status === 'ปฏิเสธ' || !verifyPassword(String(c?.password ?? ''), user.passwordHash)) return null;
        return { id: user.id || user.username, email: user.email, name: user.fullName, role: 'Admin' };
      },
    }),
    // เข้าได้เฉพาะเมื่อ DEMO_MODE=true : เลือก role แล้วเข้าเลย ไม่ใช้ OTP
    CredentialsProvider({
      id: 'demo', name: 'demo', credentials: { role: {} },
      async authorize(c) {
        if (!isDemo() || !isRole(c?.role)) return null;
        const d = DEMO_USERS[c.role];
        return { id: 'demo-' + c.role, email: d.email, name: d.name, role: c.role };
      },
    }),
    CredentialsProvider({
      credentials: { email: {}, code: {}, portal: {}, mode: {}, fullName: {}, institution: {}, citizenId: {} },
      async authorize(c) {
        const email = normEmail(c?.email);
        const portal: Portal = c?.portal === 'admin' ? 'admin' : 'user';
        const mode = c?.mode === 'teacher' ? 'teacher' : c?.mode === 'student' ? 'student' : 'email';
        const citizenId = String(c?.citizenId ?? '').replace(/\D/g, '');
        const rawUser = mode === 'student' ? await findUserByCitizenId(citizenId) : await findUserByEmail(email);
        const user = rawUser ? normaliseDveRow(rawUser) : null;
        if (!user) return null;
        if (mode === 'student') {
          const stripTitle = (value: unknown) => normPersonName(value).replace(/^(นางสาว|เด็กชาย|เด็กหญิง|อาจารย์|นาย|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.)\s*/i, '');
          const enteredName = `${String(c?.fullName ?? '').trim()}`;
          if (!/^\d{13}$/.test(citizenId) || !eligible(user, portal, 'student', { citizenId }) || stripTitle(user.fullName) !== stripTitle(enteredName)) return null;
          if (await emailUsedByAnotherAccount(email, rawUser || undefined)) return null;
        } else if (mode === 'teacher') {
          if (user.role !== 'Teacher' || normPersonName(user.fullName) !== normPersonName(c?.fullName) || await emailUsedByAnotherAccount(email, rawUser || undefined)) return null;
        } else if (!eligible(user, portal, mode, { fullName: c?.fullName, institution: c?.institution, email })) return null; // ตรวจข้อมูลตามพอร์ทัลซ้ำตอนยืนยัน
        const r = await verifyOtp(email, String(c?.code ?? ''));
        if (!r.ok) return null;
        if (mode === 'student' && rawUser) {
          rawUser.profileEmail = email;
          await saveUser(rawUser);
          invalidateLookupCache();
        }
        // role มาจากชีตฝั่งเซิร์ฟเวอร์เท่านั้น
        return { id: user.id || email, email, name: user.fullName, role: user.role as Role };
      },
    }),
    CredentialsProvider({
      id: 'citizen-fallback', name: 'citizen-fallback', credentials: { last5: {}, portal: {}, mode: {} },
      async authorize(c, req) {
        if (c?.portal !== 'user' || c?.mode !== 'student') return null;
        const last5 = String(c?.last5 ?? '').replace(/\D/g, '');
        const forwarded = req.headers?.['x-forwarded-for'];
        const ip = String(Array.isArray(forwarded) ? forwarded[0] : forwarded || req.headers?.['x-real-ip'] || 'unknown').split(',')[0].trim();
        if (last5.length !== 5 || !(await rateLimit(`fallback:${last5}`, 5, 600)) || !(await rateLimit(`fallback-ip:${ip}`, 30, 600))) return null;
        const rawUser = await findUniqueStudentByCitizenLast5(last5);
        const user = rawUser ? normaliseDveRow(rawUser) : null;
        if (!user || user.role !== 'Intern' && user.role !== 'DVE' || user.status === 'ปฏิเสธ') return null;
        const citizenDigits = String(user.citizenId || '').replace(/\D/g, '');
        if (citizenDigits.length !== 13 || citizenDigits.slice(-5) !== last5) return null;
        const accountEmail = normEmail(user.email || user.profileEmail);
        const sessionKey = accountEmail || `citizen:${citizenDigits}`;
        return { id: user.id || sessionKey, email: sessionKey, name: user.fullName, role: user.role as Role };
      },
    }),
    CredentialsProvider({
      id: 'returning-student', name: 'returning-student', credentials: { firstName: {}, lastName: {}, last5: {}, portal: {}, mode: {} },
      async authorize(c, req) {
        if (c?.portal !== 'user' || c?.mode !== 'student') return null;
        const firstName = String(c?.firstName ?? '').trim();
        const lastName = String(c?.lastName ?? '').trim();
        const last5 = String(c?.last5 ?? '').replace(/\D/g, '');
        const forwarded = req.headers?.['x-forwarded-for'];
        const ip = String(Array.isArray(forwarded) ? forwarded[0] : forwarded || req.headers?.['x-real-ip'] || 'unknown').split(',')[0].trim();
        const key = `${normPersonName(`${firstName} ${lastName}`)}:${last5}`;
        if (!firstName || !lastName || last5.length !== 5 || !(await rateLimit(`returning-login:${key}`, 5, 600)) || !(await rateLimit(`returning-login-ip:${ip}`, 30, 600))) return null;
        const rawUser = await findConfirmedStudentByNameAndLast5(firstName, lastName, last5);
        const user = rawUser ? normaliseDveRow(rawUser) : null;
        if (!user || !['ยืนยันแล้ว', 'ยืนยันแล้วแก้ไข'].includes(user.status) || !user.consentAt) return null;
        const citizenDigits = String(user.citizenId || '').replace(/\D/g, '');
        if (citizenDigits.length !== 13 || !citizenDigits.endsWith(last5)) return null;
        const accountEmail = normEmail(user.email || user.profileEmail);
        const sessionKey = accountEmail || `citizen:${citizenDigits}`;
        return { id: user.id || sessionKey, email: sessionKey, name: user.fullName, role: user.role as Role };
      },
    }),
    CredentialsProvider({
      id: 'returning-teacher', name: 'returning-teacher', credentials: { email: {}, fullName: {} },
      async authorize(c, req) {
        const email = normEmail(c?.email);
        const fullName = String(c?.fullName ?? '').trim();
        const forwarded = req.headers?.['x-forwarded-for'];
        const ip = String(Array.isArray(forwarded) ? forwarded[0] : forwarded || req.headers?.['x-real-ip'] || 'unknown').split(',')[0].trim();
        if (!email || !fullName || !(await rateLimit(`returning-teacher:${email}`, 5, 600)) || !(await rateLimit(`returning-teacher-ip:${ip}`, 30, 600))) return null;
        const rawUser = await findUserByEmail(email, true);
        const user = rawUser ? normaliseDveRow(rawUser) : null;
        // การรับทราบกฎระเบียบไม่ใช่เงื่อนไข Login ซ้ำ แต่ PDPA ต้องยินยอมแล้ว
        if (!user || user.role !== 'Teacher' || user.status === 'ปฏิเสธ' || !user.consentAt) return null;
        if (normPersonName(user.fullName) !== normPersonName(fullName) || await emailUsedByAnotherAccount(email, rawUser || undefined)) return null;
        return { id: user.id || email, email, name: user.fullName, role: 'Teacher' as Role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) { if (user) { token.role = user.role; token.email = user.email; } return token; },
    async session({ session, token }) {
      if (isRole(token.role)) session.user.role = token.role;
      if (token.email) session.user.email = token.email;
      return session;
    },
  },
};

// ตรวจสิทธิ์ซ้ำในทุก API/หน้า (นอกเหนือจาก middleware)
export async function requireSession(roles?: Role[]) {
  const s = await getServerSession(authOptions);
  const u = s?.user;
  if (!u?.email || !isRole(u.role)) return null;
  if (roles && !roles.includes(u.role)) return null;
  return { email: u.email, role: u.role, name: u.name || '' };
}
export { saveUser };
