import { NextResponse } from 'next/server';
import { createOtp } from '@/lib/otp';
import { sendOtpEmail } from '@/lib/gmail';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { eligible, emailUsedByAnotherAccount, findUserByCitizenId, findUserByEmail, invalidateLookupCache, normaliseDveRow, type Mode, type Portal, type UserRow } from '@/lib/users';
import { isEmail, normEmail, normName, normPersonName } from '@/lib/validators';
import { sameOrigin } from '@/lib/security';
import { appendRow } from '@/lib/sheets';

const NEUTRAL = 'หากข้อมูลถูกต้อง ระบบได้ส่งรหัสยืนยันไปยังอีเมลที่ลงทะเบียนไว้แล้ว (รหัสใช้ได้ภายใน 10 นาที)';
const ok = () => NextResponse.json({ message: NEUTRAL });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const portal: Portal = body.portal === 'admin' ? 'admin' : 'user';
  const mode: Mode = portal === 'user' && ['student', 'teacher'].includes(body.mode) ? body.mode : body.mode === 'institution' && portal === 'user' ? 'institution' : 'email';
  const email = normEmail(body.email);
  const ip = clientIp(req.headers);

  if (!isEmail(email)) return NextResponse.json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }, { status: 400 });

  const adminP = portal === 'admin';
  let stage = 'ตรวจสอบข้อมูลบัญชี';

  try {
    let rawUser: UserRow | null = mode === 'student' ? await findUserByCitizenId(String(body.citizenId || '')) : await findUserByEmail(email);
    let user: UserRow | null = rawUser ? normaliseDveRow(rawUser) : null;
    // อาจารย์ใหม่สมัครครั้งแรกได้โดยไม่ต้องมีข้อมูลอยู่ก่อนใน Teachers
    if (mode === 'teacher' && !rawUser) {
      if (await emailUsedByAnotherAccount(email)) return NextResponse.json({ error: 'อีเมลนี้ถูกใช้กับบัญชีอื่นในระบบแล้ว กรุณาใช้อีเมลของตนเอง' }, { status: 409 });
      const fullName = normName(body.fullName);
      if (fullName.length < 2 || fullName.length > 100) return NextResponse.json({ error: 'กรุณากรอกชื่อ–นามสกุลให้ถูกต้อง' }, { status: 400 });
      const now = new Date().toISOString();
      const teacher = {
        id: `teacher-${Date.now()}`, email, fullName, phone: '', birthDate: '', institution: '', role: 'Teacher', status: 'รอตรวจสอบ',
        verifiedAt: '', createdAt: now, consentAt: '', citizenId: '', username: '', passwordHash: '', level: '', startDate: '', endDate: '', profileImageUrl: '', profileEmail: email,
        _row: 0, _tab: 'Teachers',
      } as unknown as UserRow;
      stage = 'บันทึกบัญชีอาจารย์';
      await appendRow('Teachers', teacher);
      invalidateLookupCache();
      rawUser = teacher;
      user = teacher;
    }
    const isEligible = mode === 'teacher'
      ? Boolean(user && user.role === 'Teacher' && normPersonName(user.fullName) === normPersonName(body.fullName))
      : eligible(user, portal, mode, { fullName: body.fullName, email, citizenId: body.citizenId });
    // นักศึกษาตรวจสอบจากเลขบัตรประชาชนกับ Backend ก่อนจึงจะไปขั้น OTP ได้
    if (!isEligible && mode === 'student') {
      return NextResponse.json({ error: 'เลขบัตรประชาชนไม่ตรงกับข้อมูลในระบบ กรุณาตรวจสอบอีกครั้ง' }, { status: 403 });
    }
    if (!isEligible && mode === 'teacher') {
      return NextResponse.json({ error: 'ข้อมูลอาจารย์ไม่ตรงกับข้อมูลในระบบ กรุณาตรวจสอบชื่อ–นามสกุลและอีเมลอีกครั้ง' }, { status: 403 });
    }
    if (!isEligible) return ok();
    if (await emailUsedByAnotherAccount(email, rawUser || user || undefined)) {
      return NextResponse.json({ error: 'อีเมลนี้ถูกใช้กับบัญชีอื่นในระบบแล้ว กรุณาใช้อีเมลของตนเอง' }, { status: 409 });
    }
    // นับ cooldown เฉพาะข้อมูลที่ผ่านการตรวจแล้วเท่านั้น
    // การกรอกข้อมูลผิดจะไม่ทำให้ผู้ใช้ที่แก้ข้อมูลถูกต้องต้องรอ 60 วินาที
    const okIp = await rateLimit(`ip:${portal}:${ip}`, adminP ? 5 : 10, 600);
    const okEmail = await rateLimit(`email:${portal}:${email}`, adminP ? 3 : 5, 600);
    if (!okIp || !okEmail) return NextResponse.json({ error: 'ขอรหัสบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' }, { status: 429 });
    // นักศึกษาที่มาจาก Excel อาจยังไม่มีอีเมลในชีท ให้ผูกอีเมลที่กรอกกับแถวที่เลขบัตรตรงกัน
    const targetEmail = mode === 'student' || mode === 'teacher' ? email : user?.email?.trim().toLowerCase();
    if (!targetEmail) return ok();
    stage = 'สร้างรหัส OTP';
    const r = await createOtp(targetEmail);
    if (!r.ok) return NextResponse.json({ error: 'กรุณารอ 60 วินาทีก่อนขอ OTP ใหม่' }, { status: 429 });
    stage = 'ส่งอีเมล OTP';
    await sendOtpEmail(targetEmail, r.code);
  } catch (e) {
    console.error(`otp request failed at ${stage}`, e);
    const error = stage === 'ส่งอีเมล OTP'
      ? 'สร้างรหัสแล้ว แต่ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า Gmail OAuth'
      : stage === 'สร้างรหัส OTP'
        ? 'บันทึกรหัส OTP ไม่สำเร็จ กรุณาตรวจสอบ OTP_SECRET และการเชื่อมต่อ Google Sheets'
        : 'ตรวจสอบหรือบันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ Google Sheets';
    return NextResponse.json({ error }, { status: 502 });
  }
  return ok(); // ตอบเหมือนกันทุกกรณี ไม่เปิดเผยว่ามีอีเมลในระบบหรือไม่
}
