import { NextResponse } from 'next/server';
import { appendRow } from '@/lib/sheets';
import { findAdminByEmail, findAdminByUsername } from '@/lib/users';
import { isEmail, normEmail, normName } from '@/lib/validators';
import { hashPassword } from '@/lib/password';
import { sameOrigin } from '@/lib/security';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const fullName = normName(body.fullName);
  const email = normEmail(body.email);
  const username = String(body.username ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const inviteCode = String(body.inviteCode ?? '');
  if (!process.env.ADMIN_REGISTRATION_KEY || inviteCode !== process.env.ADMIN_REGISTRATION_KEY) return NextResponse.json({ error: 'ต้องใช้รหัสเชิญสำหรับสมัครผู้ดูแลระบบ' }, { status: 403 });
  if (fullName.length < 2) return NextResponse.json({ error: 'กรุณากรอกชื่อ-นามสกุล' }, { status: 400 });
  if (!isEmail(email)) return NextResponse.json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }, { status: 400 });
  if (!/^[a-z0-9._-]{4,32}$/.test(username)) return NextResponse.json({ error: 'Username ต้องมี 4-32 ตัว ใช้ a-z, 0-9, จุด, ขีดกลาง หรือขีดล่าง' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'Password ต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 });

  try {
    if (await findAdminByEmail(email)) return NextResponse.json({ error: 'อีเมลนี้มีอยู่ในระบบแล้ว กรุณาเข้าสู่ระบบ Admin' }, { status: 409 });
    if (await findAdminByUsername(username)) return NextResponse.json({ error: 'Username นี้มีอยู่ในระบบแล้ว' }, { status: 409 });
    await appendRow('AdminUsers', {
      id: crypto.randomUUID(), email, fullName, username, passwordHash: hashPassword(password),
      status: 'ยืนยันแล้ว', verifiedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('admin registration failed', e);
    return NextResponse.json({ error: 'บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ Google Sheet' }, { status: 500 });
  }
}
