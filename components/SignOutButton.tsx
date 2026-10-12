'use client';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import FeedbackModal from './FeedbackModal';
export default function SignOutButton({ to = '/login', className = '', label = 'ออกจากระบบ' }: { to?: string; className?: string; label?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function confirmSignOut() {
    if (busy) return;
    setBusy(true);
    try { await signOut({ redirect: false }); }
    finally { window.location.replace(to); }
  }
  return <><button type="button" onClick={() => setOpen(true)} className={`inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 active:translate-y-0 ${className}`}>{label}</button>{open && <FeedbackModal title="ออกจากระบบ" message="คุณต้องการออกจากระบบใช่หรือไม่" tone="info" actionLabel={busy ? 'กำลังออกจากระบบ...' : 'ยืนยันออกจากระบบ'} onCancel={() => !busy && setOpen(false)} onClose={confirmSignOut} />}</>;
}
