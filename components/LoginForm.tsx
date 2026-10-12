'use client';
import { useEffect, useState } from 'react';
import { getSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { HOME } from '@/lib/permissions';

type Portal = 'user' | 'admin';
type UserMode = 'student' | 'teacher';

export default function LoginForm({ portal }: { portal: Portal }) {
  const router = useRouter();
  const isAdmin = portal === 'admin';
  const [mode, setMode] = useState<UserMode>('student');
  const [step, setStep] = useState<'request' | 'code'>('request');
  const [email, setEmail] = useState(isAdmin ? 'admin@example.com' : '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [teacherFirstName, setTeacherFirstName] = useState('');
  const [teacherLastName, setTeacherLastName] = useState('');
  const [citizenId, setCitizenId] = useState('');
  const [institution, setInstitution] = useState('');
  const [institutions, setInstitutions] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [last5, setLast5] = useState('');
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; s: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (!isAdmin && mode === 'teacher' && !institutions.length)
      fetch('/api/institutions').then((r) => r.json()).then((d) => setInstitutions(d.institutions || [])).catch(() => setMsg({ t: 'err', s: 'โหลดรายชื่อสถานศึกษาไม่สำเร็จ' }));
  }, [isAdmin, mode, institutions.length]);
  useEffect(() => {
    if (!isAdmin) return;
    const query = new URLSearchParams(window.location.search);
    const registeredEmail = query.get('email');
    if (registeredEmail) setEmail(registeredEmail);
    if (query.get('registered') === '1') setMsg({ t: 'ok', s: 'สมัครสำเร็จ กรุณาขอรหัส OTP เพื่อเข้าสู่ระบบ' });
  }, [isAdmin]);
  useEffect(() => { if (wait > 0) { const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); } }, [wait]);

  async function requestOtp(e?: React.FormEvent) {
    e?.preventDefault();
    const name = isAdmin ? '' : mode === 'student' ? `${firstName.trim()} ${lastName.trim()}`.trim() : `${teacherFirstName.trim()} ${teacherLastName.trim()}`.trim();
    if (!isAdmin && mode === 'student' && !/^\d{13}$/.test(citizenId)) return setMsg({ t: 'err', s: 'กรุณากรอกเลขบัตรประชาชน 13 หลัก' });
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/otp/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ portal, mode: isAdmin ? 'email' : mode, email, fullName: name, citizenId }) });
      const d = await r.json();
      if (!r.ok) setMsg({ t: 'err', s: d.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
      else { setMsg({ t: 'ok', s: d.message }); setStep('code'); setWait(60); }
    } catch { setMsg({ t: 'err', s: 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่' }); }
    setBusy(false);
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const fullName = `${(mode === 'teacher' ? teacherFirstName : firstName).trim()} ${(mode === 'teacher' ? teacherLastName : lastName).trim()}`.trim();
    const r = await signIn('credentials', { redirect: false, email, code, portal, mode, fullName, institution });
    if (!r || r.error) { setMsg({ t: 'err', s: 'รหัสไม่ถูกต้อง หมดอายุ หรือถูกใช้ไปแล้ว กรุณาขอรหัสใหม่' }); setBusy(false); return; }
    const s = await getSession();
    router.replace(s?.user?.role === 'Admin' ? '/admin' : '/confirm');
  }

  async function submitFallback(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await signIn('citizen-fallback', { redirect: false, email, last5, mode, portal });
    if (!r || r.error) { setMsg({ t: 'err', s: 'ข้อมูลไม่ถูกต้อง หรือใช้สิทธิ์สำรองครบจำนวนแล้ว' }); setBusy(false); return; }
    const s = await getSession();
    router.replace(s?.user?.role === 'Admin' ? '/admin' : '/confirm');
  }

  async function submitAdmin(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await signIn('admin-password', { redirect: false, username, password });
    if (!r || r.error) { setMsg({ t: 'err', s: 'Username หรือ Password ไม่ถูกต้อง' }); setBusy(false); return; }
    router.replace('/admin');
  }

  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-green-50 p-4">
    <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-blue-200/40 blur-3xl" />
    <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" />
    <div className="relative w-full max-w-md rounded-3xl border border-white/70 bg-white/95 p-7 shadow-2xl shadow-emerald-900/10 backdrop-blur sm:p-8">
      <div className="mb-5"><img src="/com7-logo.svg" alt="COM7 NextStep" className="h-12 w-auto object-contain object-left" /><p className="mt-2 text-sm font-semibold text-emerald-800">COM7 NextStep</p></div>
      {isAdmin && <span className="mb-2 inline-block rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">ADMIN ONLY</span>}
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{isAdmin ? 'เข้าสู่ระบบผู้ดูแลระบบ' : mode === 'student' ? 'เข้าสู่ระบบนักศึกษา' : 'เข้าสู่ระบบอาจารย์'}</h1>
      <p className="mt-1 text-sm text-gray-500">{isAdmin ? 'เข้าสู่ระบบด้วย Username และ Password' : 'กรอกข้อมูลเพื่อยืนยันตัวตน'}</p>
      {!isAdmin && step === 'request' && <div className="mt-4 grid grid-cols-2 rounded-lg bg-gray-100 p-1 text-sm">
        <button type="button" onClick={() => { setMode('student'); setMsg(null); }} className={`rounded-md px-3 py-2 ${mode === 'student' ? 'bg-white font-semibold shadow-sm' : 'text-gray-500'}`}>นักศึกษา</button>
        <button type="button" onClick={() => { setMode('teacher'); setMsg(null); }} className={`rounded-md px-3 py-2 ${mode === 'teacher' ? 'bg-white font-semibold shadow-sm' : 'text-gray-500'}`}>อาจารย์</button>
      </div>}
      {!isAdmin && step === 'code' && <p className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">อีเมลที่ใช้ยืนยัน: <span className="font-semibold">{email}</span></p>}
      {isAdmin ? <form onSubmit={submitAdmin} className="mt-4 space-y-3">
        <input className="input" required placeholder="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <div className="relative"><input className="input pr-20" required type={showPassword ? 'text' : 'password'} placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50">{showPassword ? 'ซ่อน' : 'แสดง'}</button></div>
        <button className="btn w-full" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
      </form> : step === 'request' ? <form onSubmit={requestOtp} className="mt-4 space-y-3">
        {!isAdmin && mode === 'student' && <><label className="block text-sm text-slate-600">ชื่อ (ใส่คำนำหน้า เช่น นาย / นางสาว)<input className="input mt-1" required placeholder="เช่น นายสมชาย" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label><label className="block text-sm text-slate-600">นามสกุล<input className="input mt-1" required placeholder="เช่น ใจดี" value={lastName} onChange={(e) => setLastName(e.target.value)} /></label><input className="input" required inputMode="numeric" maxLength={13} placeholder="เลขบัตรประชาชน 13 หลัก" value={citizenId} onChange={(e) => setCitizenId(e.target.value.replace(/\D/g, ''))} /></>}
        {!isAdmin && mode === 'teacher' && <><label className="block text-sm text-slate-600">ชื่อ (ใส่คำนำหน้า เช่น นาย / นางสาว / อาจารย์)<input className="input mt-1" required placeholder="เช่น อาจารย์สมชาย" value={teacherFirstName} onChange={(e) => setTeacherFirstName(e.target.value)} /></label><label className="block text-sm text-slate-600">นามสกุล<input className="input mt-1" required placeholder="เช่น ใจดี" value={teacherLastName} onChange={(e) => setTeacherLastName(e.target.value)} /></label></>}
        <label className="block text-sm text-slate-600">ระบุอีเมลที่ใช้สำหรับรับ OTP<input className="input mt-1" type="email" required placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <button className="btn w-full" disabled={busy}>{busy ? 'กำลังตรวจสอบข้อมูล...' : 'ขอรหัส OTP'}</button>
      </form> : <form onSubmit={submitCode} className="mt-4 space-y-3"><p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">กรอกรหัส OTP ที่ส่งไปยังอีเมลของคุณ</p><input className="input text-center text-2xl tracking-[0.5em]" inputMode="numeric" maxLength={6} required autoFocus placeholder="······" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /><button className="btn w-full" disabled={busy || code.length !== 6}>{busy ? 'กำลังตรวจสอบ...' : 'ยืนยันตัวตน'}</button><button type="button" disabled={wait > 0} onClick={() => { setStep('request'); setCode(''); setMsg(null); }} className="w-full text-sm text-blue-600 disabled:text-gray-400">{wait > 0 ? `ขอรหัสใหม่ได้ใน ${wait} วินาที` : 'ขอรหัสใหม่'}</button>{mode === 'student' && <><button type="button" onClick={() => { setFallbackOpen((v) => !v); setMsg(null); }} className="w-full text-sm font-medium text-slate-600 underline underline-offset-2">ไม่ได้รับข้อความ OTP คลิกที่นี่</button>{fallbackOpen && <div className="rounded-xl border border-amber-100 bg-amber-50 p-3"><p className="text-sm text-amber-900">กรอกเลขท้าย 5 ตัวของบัตรประชาชนเพื่อยืนยันแทน OTP</p><input className="input mt-2 text-center tracking-[0.35em]" inputMode="numeric" maxLength={5} required placeholder="XXXXX" value={last5} onChange={(e) => setLast5(e.target.value.replace(/\D/g, ''))} /><button type="button" onClick={submitFallback} className="btn mt-2 w-full" disabled={busy || last5.length !== 5}>{busy ? 'กำลังตรวจสอบ...' : 'ยืนยันด้วยเลขบัตรประชาชน'}</button></div>}</>}</form>}
      {msg && <p className={`mt-3 text-sm ${msg.t === 'ok' ? 'text-green-700' : 'text-red-600'}`} role="alert">{msg.s}</p>}
      {isAdmin && <a href="/login" className="mt-5 block text-center text-sm text-blue-600 hover:underline">กลับไปหน้าเข้าสู่ระบบ</a>}
      {isAdmin && <a href="/admin/register" className="mt-2 block text-center text-sm text-blue-600 hover:underline">สมัครผู้ดูแลระบบ</a>}
    </div>
  </main>;
}
