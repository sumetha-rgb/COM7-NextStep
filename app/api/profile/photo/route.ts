import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireSession, saveUser } from '@/lib/auth';
import { findUserByEmail } from '@/lib/users';
import { sameOrigin } from '@/lib/security';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 403 });
  const me = await requireSession(['Intern', 'DVE', 'Teacher']);
  if (!me) return NextResponse.json({ error: 'ไม่มีสิทธิ์อัปโหลดรูป' }, { status: 403 });
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า Cloudinary' }, { status: 503 });
  const user = await findUserByEmail(me.email);
  if (!user) return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้' }, { status: 404 });
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'กรุณาเลือกไฟล์รูปภาพ' }, { status: 400 });
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'รองรับเฉพาะไฟล์รูปภาพ' }, { status: 400 });
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: 'รูปภาพต้องมีขนาดไม่เกิน 2 MB' }, { status: 400 });

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const publicId = `user-${String(user.id || me.email).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const folder = 'otp-portal/profile';
  const signed = `folder=${folder}&overwrite=true&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(signed).digest('hex');
  const upload = new FormData();
  upload.append('file', file);
  upload.append('api_key', apiKey);
  upload.append('timestamp', timestamp);
  upload.append('folder', folder);
  upload.append('public_id', publicId);
  upload.append('overwrite', 'true');
  upload.append('signature', signature);
  const result = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: upload });
  const data = await result.json().catch(() => ({}));
  if (!result.ok || !data.secure_url) return NextResponse.json({ error: 'อัปโหลดรูปไม่สำเร็จ' }, { status: 502 });
  user.profileImageUrl = String(data.secure_url);
  await saveUser(user);
  return NextResponse.json({ ok: true, profileImageUrl: user.profileImageUrl });
}
