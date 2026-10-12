import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getServerSession } from 'next-auth';
import { verifyOtp } from './otp';
import { eligible, findUserByEmail, findAdminByUsername, normaliseDveRow, saveUser, type Portal } from './users';
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
      credentials: { email: {}, code: {}, portal: {}, mode: {}, fullName: {}, institution: {} },
      async authorize(c) {
        const email = normEmail(c?.email);
        const portal: Portal = c?.portal === 'admin' ? 'admin' : 'user';
        const rawUser = await findUserByEmail(email);
        const user = rawUser ? normaliseDveRow(rawUser) : null;
        if (!user) return null;
        const mode = c?.mode === 'teacher' ? 'teacher' : 'email';
        if (mode === 'teacher') {
          if (user.role !== 'Teacher' || normPersonName(user.fullName) !== normPersonName(c?.fullName)) return null;
        } else if (!eligible(user, portal, mode, { fullName: c?.fullName, institution: c?.institution, email })) return null; // ตรวจข้อมูลตามพอร์ทัลซ้ำตอนยืนยัน
        const r = await verifyOtp(email, String(c?.code ?? ''));
        if (!r.ok) return null;
        // role มาจากชีตฝั่งเซิร์ฟเวอร์เท่านั้น
        return { id: user.id || email, email, name: user.fullName, role: user.role as Role };
      },
    }),
    CredentialsProvider({
      id: 'citizen-fallback', name: 'citizen-fallback', credentials: { email: {}, last5: {}, portal: {}, mode: {} },
      async authorize(c) {
        if (c?.portal !== 'user' || c?.mode !== 'student') return null;
        const email = normEmail(c?.email);
        const last5 = String(c?.last5 ?? '').replace(/\D/g, '');
        if (!email || last5.length !== 5 || !(await rateLimit(`fallback:${email}`, 5, 600))) return null;
        const rawUser = await findUserByEmail(email);
        const user = rawUser ? normaliseDveRow(rawUser) : null;
        if (!user || user.role !== 'Intern' && user.role !== 'DVE' || user.status === 'ปฏิเสธ') return null;
        const citizenDigits = String(user.citizenId || '').replace(/\D/g, '');
        if (citizenDigits.length < 5 || citizenDigits.slice(-5) !== last5) return null;
        return { id: user.id || email, email, name: user.fullName, role: user.role as Role };
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
