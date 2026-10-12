import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { canAccess, HOME, isPublic, isRole } from '@/lib/permissions';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // ไฟล์ static ใน public ต้องโหลดได้โดยไม่ผ่านการตรวจสิทธิ์
  if (/\.(svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname)) return NextResponse.next();
  if (isPublic(pathname)) return NextResponse.next();
  const isApi = pathname.startsWith('/api/');
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const role = token?.role;
  if (!isRole(role)) {
    if (isApi) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    return NextResponse.redirect(new URL(pathname.startsWith('/admin') ? '/admin/login' : '/login', req.url));
  }
  if (!canAccess(role, pathname)) {
    if (isApi) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    return NextResponse.redirect(new URL(HOME[role], req.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
