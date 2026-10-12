'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Profile = { email: string; citizenId: string; fullName: string; nickname: string; institution: string; level: string; startDate: string; endDate: string; status: string; phone: string; birthDate: string; profileImageUrl: string };

export default function ProfileButton({ className = '', label = 'ข้อมูลส่วนตัว' }: { className?: string; label?: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  async function open() { const r = await fetch('/api/me', { cache: 'no-store' }); const d = await r.json(); if (!r.ok) setError(d.error || 'โหลดข้อมูลไม่สำเร็จ'); else { setProfile(d); setPhoto(d.profileImageUrl || ''); } }
  function close() { setProfile(null); setError(''); setPhotoError(''); }
  async function choosePhoto(file?: File) {
    setPhotoError(''); if (!file) return;
    if (!file.type.startsWith('image/')) return setPhotoError('กรุณาเลือกไฟล์รูปภาพ');
    if (file.size > 2 * 1024 * 1024) return setPhotoError('รูปภาพต้องมีขนาดไม่เกิน 2 MB');
    const body = new FormData(); body.append('file', file);
    const response = await fetch('/api/profile/photo', { method: 'POST', body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setPhotoError(data.error || 'อัปโหลดรูปไม่สำเร็จ');
    const nextPhoto = data.profileImageUrl || ''; setPhoto(nextPhoto);
    window.dispatchEvent(new CustomEvent('profile-photo-updated', { detail: nextPhoto }));
  }
  const modal = (profile || error) && <div className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center bg-slate-900/45 p-2 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && close()}>
    <div className="w-[calc(100vw-1rem)] max-w-md rounded-3xl bg-white p-4 shadow-2xl sm:p-5" role="dialog" aria-modal="true" aria-labelledby="profile-title">
      <div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">COM7 NextStep</p><h2 id="profile-title" className="text-xl font-bold text-slate-900">ข้อมูลส่วนตัว</h2></div><button type="button" onClick={close} className="flex h-8 w-8 items-center justify-center rounded-full text-2xl text-slate-400 hover:bg-slate-100" aria-label="ปิด">×</button></div>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : profile && <><div className="mt-2 flex items-center gap-3 rounded-2xl bg-emerald-50 p-2.5"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-200 text-lg font-bold text-emerald-700">{photo ? <img src={photo} alt="รูปโปรไฟล์" className="h-full w-full object-cover" /> : profile.fullName.slice(0, 1)}</div><div><p className="font-semibold text-slate-800">รูปโปรไฟล์</p><label className="cursor-pointer text-xs font-medium text-emerald-700 hover:underline">เลือกรูปภาพ<input type="file" accept="image/*" className="hidden" onChange={(e) => choosePhoto(e.target.files?.[0])} /></label>{photoError && <p className="text-[11px] text-red-600">{photoError}</p>}</div></div><div className="mt-1 grid grid-cols-2 gap-x-3"><Info label="เลขบัตรประชาชน" value={profile.citizenId || '-'} /><Info label="ชื่อ-นามสกุล" value={profile.fullName} /><Info label="ชื่อเล่น" value={profile.nickname || '-'} /><Info label="Email" value={profile.email} /><Info label="เบอร์โทร" value={profile.phone || '-'} /><Info label="วันเกิด" value={profile.birthDate || '-'} /><Info label="สถานศึกษา" value={profile.institution || '-'} /><Info label="ระดับชั้น" value={profile.level || '-'} /><Info label="วันที่เริ่มงาน" value={profile.startDate || '-'} /><Info label="วันที่สิ้นสุด" value={profile.endDate || '-'} /><Info label="สถานะ" value={profile.status || '-'} /></div></>}
    </div>
  </div>;
  return <><button type="button" onClick={open} className={`inline-flex items-center justify-center text-center rounded-lg border border-emerald-200 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50 ${className}`}>{label}</button>{mounted && modal ? createPortal(modal, document.body) : null}</>;
}
const Info = ({ label, value }: { label: string; value: string }) => <div className="min-w-0 border-b border-slate-100 py-1.5"><p className="truncate text-[11px] text-slate-500">{label}</p><p className="truncate text-sm font-medium text-slate-800" title={value}>{value}</p></div>;
