'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function ReturningStudentLoginForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [last5, setLast5] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const result = await signIn('returning-student', {
      redirect: false,
      firstName,
      lastName,
      last5,
      mode: 'student',
      portal: 'user',
    });
    if (!result || result.error) {
      setError('ข้อมูลไม่ตรง หรือบัญชียังไม่ผ่านการยืนยันตัวตนครั้งแรก');
      setBusy(false);
      return;
    }
    router.replace('/rules');
  }

  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-green-50 p-4">
    <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-blue-200/40 blur-3xl" />
    <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" />
    <section className="relative w-full max-w-md rounded-3xl border border-white/70 bg-white/95 p-7 shadow-2xl shadow-emerald-900/10 backdrop-blur sm:p-8">
      <div className="mb-5">
        <img src="/com7-logo.svg" alt="COM7 NextStep" className="h-12 w-auto object-contain object-left" />
        <p className="mt-2 text-sm font-semibold text-emerald-800">COM7 NextStep</p>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">เข้าสู่ระบบผู้ที่ยืนยันแล้ว</h1>
      <p className="mt-1 text-sm text-slate-500">สำหรับผู้ที่ยืนยันตัวตนครั้งแรกและยินยอมข้อมูลแล้ว</p>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <label className="block text-sm text-slate-600">ชื่อ<input className="input mt-1" required autoComplete="given-name" placeholder="เช่น นายสมชาย" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
        <label className="block text-sm text-slate-600">นามสกุล<input className="input mt-1" required autoComplete="family-name" placeholder="เช่น ใจดี" value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
        <label className="block text-sm text-slate-600">เลขบัตรประชาชน 5 ตัวท้าย<input className="input mt-1 text-center tracking-[0.35em]" required inputMode="numeric" autoComplete="off" maxLength={5} pattern="[0-9]{5}" placeholder="XXXXX" value={last5} onChange={(e) => setLast5(e.target.value.replace(/\D/g, ''))} /></label>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <button className="btn w-full" disabled={busy || !firstName.trim() || !lastName.trim() || last5.length !== 5}>{busy ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}</button>
      </form>
      <a href="/login" className="mt-5 block text-center text-sm text-emerald-800 hover:underline">กลับไปเข้าสู่ระบบด้วย OTP</a>
    </section>
  </main>;
}
