import 'next-auth';
import 'next-auth/jwt';
import type { Role } from '@/lib/permissions';
declare module 'next-auth' {
  interface User { role: Role }
  interface Session { user: { email: string; name?: string | null; role: Role } }
}
declare module 'next-auth/jwt' { interface JWT { role?: Role } }
