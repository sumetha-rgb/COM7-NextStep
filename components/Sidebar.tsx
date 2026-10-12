'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import SignOutButton from './SignOutButton';
import FeedbackModal from './FeedbackModal';

const MENU = [
  { href: '/admin', label: 'ภาพรวม', icon: 'dashboard' as const },
  { href: '/admin/audit', label: 'ประวัติการแก้ไขข้อมูล', icon: 'history' as const },
  { href: '/admin/rules-preview', label: 'ตัวอย่างกฎระเบียบ', icon: 'book' as const },
  { href: '/admin/rules-consent', label: 'การประเมิน', icon: 'check' as const },
];
export default function Sidebar({ email, fullName, username }: { email: string; fullName: string; username: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const initials = (fullName || 'A').trim().slice(0, 1).toUpperCase();
  return (
    <>
      <div className="flex items-center justify-between border-b border-emerald-100 bg-white p-3 md:hidden">
        <img src="/com7-logo.svg" alt="COM7" className="h-8 w-auto" />
        <button onClick={() => setOpen(!open)} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-sm text-emerald-800">เมนู</button>
      </div>
      <aside className={`${open ? 'block' : 'hidden'} flex min-h-[calc(100vh-65px)] w-full shrink-0 flex-col border-r border-emerald-100 bg-white p-4 md:sticky md:top-0 md:flex md:h-screen md:min-h-screen md:w-72 md:overflow-y-auto`}>
        <div className="mb-8 hidden items-center gap-3 px-2 md:flex">
          <img src="/com7-logo.svg" alt="COM7 NextStep" className="h-10 w-auto" />
          <div><p className="text-sm font-bold text-emerald-800">COM7 NextStep</p><p className="text-xs text-slate-500">ระบบจัดการข้อมูล</p></div>
        </div>
        <nav className="space-y-2">
          {MENU.map((m) => {
            const active = m.href === '/admin' ? path === '/admin' : path.startsWith(m.href);
            return <Link key={m.href} href={m.href} onClick={() => setOpen(false)}
              className={`group flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium transition ${active ? 'border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-900/10' : 'border-transparent text-slate-700 hover:border-emerald-100 hover:bg-emerald-50 hover:text-emerald-800'}`}>
              <Icon name={m.icon} active={active} />{m.label}
            </Link>;
          })}
        </nav>
        <div className="sticky bottom-0 mt-auto border-t border-emerald-100 bg-white pt-4">
          <button onClick={() => setProfileOpen(true)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-emerald-50">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">{initials}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{fullName}</span><span className="block truncate text-xs text-slate-500">{username ? `@${username}` : 'ผู้ดูแลระบบ'}</span></span>
            <span className="text-slate-400">›</span>
          </button>
          <div className="mt-3"><SignOutButton to="/admin/login" className="w-full border-emerald-200 text-emerald-800 hover:bg-emerald-50" /></div>
        </div>
      </aside>
      {profileOpen && <FeedbackModal title="โปรไฟล์ผู้ดูแลระบบ" message={`${fullName}\n${username ? `ชื่อผู้ใช้: ${username}\n` : ''}${email}`} tone="info" actionLabel="ปิด" onClose={() => setProfileOpen(false)} />}
    </>
  );
}

function Icon({ name, active }: { name: 'dashboard' | 'history' | 'book' | 'check'; active: boolean }) {
  const cls = `h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-emerald-500 group-hover:text-emerald-700'}`;
  if (name === 'history') return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" d="M3 12a9 9 0 1 0 3-6.7"/><path strokeLinecap="round" strokeLinejoin="round" d="M3 4v5h5M12 7v5l3 2"/></svg>;
  if (name === 'book') return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5m0-17v17M8 6h8m-8 4h8"/></svg>;
  if (name === 'check') return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="m8 12 2.5 2.5L16.5 9" /></svg>;
  return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}
