'use client';
import ProfileButton from './ProfileButton';
import SignOutButton from './SignOutButton';

export default function MobileBottomNav() {
  return (
    <nav className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-30 flex w-[calc(100vw-1rem)] max-w-lg -translate-x-1/2 items-center justify-around rounded-3xl bg-white/95 p-1.5 shadow-[0_10px_35px_rgba(15,23,42,0.16)] backdrop-blur sm:bottom-6 sm:w-[calc(100vw-3rem)] sm:p-2" aria-label="เมนูหลัก">
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl bg-emerald-50 px-2 py-2 text-emerald-700">
        <BookIcon />
        <span className="text-xs font-bold leading-4">กฎระเบียบ</span>
      </div>
      <div className="flex min-w-0 flex-1 justify-center"><ProfileButton className="!min-h-0 !w-full !flex-col !gap-1 !rounded-2xl !border-0 !bg-transparent !px-2 !py-2 !shadow-none !text-slate-500 hover:!bg-slate-50" label={<><UserIcon /><span className="text-xs font-bold leading-4">ข้อมูลส่วนตัว</span></>} /></div>
      <div className="flex min-w-0 flex-1 justify-center"><SignOutButton className="!min-h-0 !w-full !flex-col !gap-1 !rounded-2xl !border-0 !bg-transparent !px-2 !py-2 !shadow-none !text-red-500 hover:!bg-red-50" label={<><LogoutIcon /><span className="text-xs font-bold leading-4">ออกจากระบบ</span></>} /></div>
    </nav>
  );
}

function BookIcon() { return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M8 6h8M8 10h8"/></svg>; }
function UserIcon() { return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="7" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0M3 21h18"/></svg>; }
function LogoutIcon() { return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/></svg>; }
