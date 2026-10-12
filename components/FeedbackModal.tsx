'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function FeedbackModal({ title, message, tone = 'success', onClose, actionLabel = 'ตกลง', onCancel, cancelLabel = 'ยกเลิก' }: { title: string; message: string; tone?: 'success' | 'error' | 'info'; onClose: () => void; actionLabel?: string; onCancel?: () => void; cancelLabel?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const color = tone === 'error' ? 'bg-red-100 text-red-600' : tone === 'info' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600';
  const modal = <div className="fixed inset-0 z-[110] flex min-h-dvh items-center justify-center bg-slate-900/45 p-4" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
    <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-center shadow-2xl sm:p-6">
      <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-2xl font-bold ${color}`}>{tone === 'error' ? '!' : '✓'}</div>
      <h2 id="feedback-title" className="text-lg font-bold text-slate-900">{title}</h2><p className="mt-2 whitespace-pre-line text-sm text-slate-600">{message}</p>
      <div className={`mt-5 grid gap-2 ${onCancel ? 'grid-cols-2' : 'grid-cols-1'}`}>{onCancel && <button type="button" onClick={onCancel} className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-600 hover:bg-slate-50">{cancelLabel}</button>}<button type="button" onClick={onClose} className="btn min-h-12 w-full rounded-2xl">{actionLabel}</button></div>
    </div>
  </div>;
  return mounted ? createPortal(modal, document.body) : null;
}
