 'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FeedbackModal from '@/components/FeedbackModal';

export default function AdminRegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/admin/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fullName, email, username, password, inviteCode }) });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || 'สมัครสมาชิกไม่สำเร็จ'); setBusy(false); return; }
      setSuccess(true);
    } catch { setMsg('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่'); setBusy(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-emerald-50 p-4">
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-7 shadow-2xl sm:p-8">
      <img src="/com7-logo.svg" alt="COM7 NextStep" className="h-12 w-auto" />
      <p className="mb-5 mt-2 text-sm font-semibold text-emerald-800">COM7 NextStep</p>
      <span className="mb-3 inline-block rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">ADMIN ONLY</span>
      <h1 className="text-2xl font-bold text-slate-900">สมัครผู้ดูแลระบบ</h1>
      <p className="mt-1 text-sm text-gray-500">การสมัครต้องใช้รหัสเชิญจากผู้ดูแลระบบ</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input className="input" required placeholder="ชื่อ-นามสกุล" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input className="input" required type="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" required placeholder="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <div className="relative"><input className="input pr-20" required minLength={8} type={showPassword ? 'text' : 'password'} placeholder="Password อย่างน้อย 8 ตัวอักษร" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50">{showPassword ? 'ซ่อน' : 'แสดง'}</button></div>
        <input className="input" required placeholder="รหัสเชิญจากผู้ดูแลระบบ" autoComplete="off" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
        <button className="btn w-full" disabled={busy}>{busy ? 'กำลังบันทึก...' : 'สมัครผู้ดูแลระบบ'}</button>
      </form>
      {msg && <p className="mt-3 text-sm text-red-600" role="alert">{msg}</p>}
      {success && <FeedbackModal title="สมัครสำเร็จ" message="สร้างบัญชี Admin เรียบร้อยแล้ว สามารถเข้าสู่ระบบด้วย Username และ Password ได้ทันที" onClose={() => router.replace('/admin/login')} />}
      <a href="/admin/login" className="mt-5 block text-center text-sm text-blue-600 hover:underline">กลับไปเข้าสู่ระบบ Admin</a>
    </div>
  </main>;
}
