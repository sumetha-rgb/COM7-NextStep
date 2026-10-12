'use client';
import { useEffect, useState } from 'react';

export default function UserHeader({ name, profileImageUrl = '' }: { name: string; profileImageUrl?: string }) {
  const [photo, setPhoto] = useState(profileImageUrl);
  useEffect(() => {
    const update = (event: Event) => setPhoto((event as CustomEvent<string>).detail || '');
    window.addEventListener('profile-photo-updated', update);
    return () => window.removeEventListener('profile-photo-updated', update);
  }, []);
  return <header className="sticky top-0 z-20 border-b border-emerald-100/80 bg-white/90 px-4 py-3 backdrop-blur sm:px-6"><div className="mx-auto flex max-w-4xl items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-600 text-lg font-bold text-white shadow-sm">{photo ? <img src={photo} alt="รูปโปรไฟล์" className="h-full w-full object-cover" /> : 'C'}</div><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600">COM7 NextStep</p><p className="truncate text-sm font-semibold text-slate-800">{name}</p></div></div></header>;
}
