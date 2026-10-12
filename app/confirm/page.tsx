import { notFound, redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { findUserByEmail, normaliseDveRow } from '@/lib/users';
import { maskBirth, maskPhone } from '@/lib/validators';
import { isDemo } from '@/lib/demo';
import ConfirmForm from '@/components/ConfirmForm';

export const dynamic = 'force-dynamic';
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const params = await searchParams;
  if (params.demo === '1') {
    if (!isDemo()) notFound();
    const demoUser = { phone: '0812345678', birthDate: '16-12-2547' };
    return <ConfirmForm demo initial={{
      email: 'intern@example.com', fullName: 'นายตัวอย่าง นักศึกษาฝึกงาน', nickname: 'ตัวอย่าง', role: 'Intern',
      institution: 'วิทยาลัยเทคนิคตัวอย่าง', level: 'ปวช.', phone: demoUser.phone, birthDate: demoUser.birthDate,
      phoneMasked: maskPhone(demoUser.phone), birthMasked: maskBirth(demoUser.birthDate), startDate: '01-10-2569', endDate: '31-12-2569', consented: false,
    }} />;
  }
  const me = await requireSession(['Intern', 'DVE', 'Teacher']);
  if (!me) redirect('/login');
  const raw = await findUserByEmail(me.email, true);
  const u = raw ? normaliseDveRow(raw) : null;
  if (!u || u.status === 'ปฏิเสธ') redirect('/login');
  if (['ยืนยันแล้ว', 'ยืนยันแล้วแก้ไข'].includes(u.status)) redirect('/rules');
  return <ConfirmForm initial={{ email: u.email || u.profileEmail || (me.email.startsWith('citizen:') ? 'ยืนยันด้วยเลขท้ายบัตรประชาชน' : me.email), fullName: u.fullName, nickname: u.nickname || '', role: u.role, institution: u.institution || '', level: u.level || (u.role === 'DVE' ? 'ปวส.' : ''), phone: u.phone, birthDate: u.birthDate, phoneMasked: maskPhone(u.phone), birthMasked: maskBirth(u.birthDate), startDate: u.startDate || raw?.actualStartDate || '', endDate: u.endDate || raw?.actualEndDate || '', consented: !!u.consentAt }} />;
}
