'use client';
import { signIn } from 'next-auth/react';
import { HOME, ROLES, type Role } from '@/lib/permissions';
const LABEL: Record<Role, string> = { Intern: 'นักศึกษาฝึกงาน', DVE: 'ทวิภาคี', Teacher: 'อาจารย์นิเทศ', Admin: 'Admin' };
export const go = (r: Role) => signIn('demo', { role: r, callbackUrl: HOME[r] });

export default function DemoBar() {
  return (
    <div className="fixed bottom-3 left-1/2 z-50 flex max-w-[95vw] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-amber-100 px-3 py-2 text-xs shadow-lg ring-1 ring-amber-300">
      <b className="text-amber-900">DEMO ดูมุมมอง:</b>
      {ROLES.map((r) => <button key={r} onClick={() => go(r)} className="rounded-full bg-white px-3 py-1 hover:bg-amber-200">{LABEL[r]}</button>)}
      <a href="/confirm?demo=1" className="rounded-full bg-white px-3 py-1 hover:bg-amber-200">ตัวอย่างยืนยันข้อมูล</a>
      <a href="/login" className="rounded-full bg-white px-3 py-1 hover:bg-amber-200">/login</a>
      <a href="/admin/login" className="rounded-full bg-white px-3 py-1 hover:bg-amber-200">/admin/login</a>
    </div>
  );
}
