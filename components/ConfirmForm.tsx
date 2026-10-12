'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Initial = {
  email: string; fullName: string; nickname: string; phone: string; birthDate: string; role: string;
  institution: string; level: string; phoneMasked: string; birthMasked: string; startDate: string; endDate: string; consented: boolean;
};

export default function ConfirmForm({ initial, demo = false }: { initial: Initial; demo?: boolean }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.fullName);
  const [nickname, setNickname] = useState(initial.nickname);
  const [institution, setInstitution] = useState(initial.institution);
  const [phone, setPhone] = useState(() => {
    const digits = String(initial.phone || '').replace(/\D/g, '').slice(0, 10);
    return digits && !digits.startsWith('0') ? `0${digits.slice(0, 9)}` : digits;
  });
  const [birthDate, setBirthDate] = useState(initial.birthDate);
  // ต้องให้ผู้ใช้ยินยอมด้วยตนเองทุกครั้งที่เปิดแบบฟอร์มยืนยันนี้
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [institutions, setInstitutions] = useState<string[]>([]);
  useEffect(() => { fetch('/api/institutions').then((r) => r.ok ? r.json() : []).then((d) => setInstitutions(Array.isArray(d) ? d : d.institutions || [])).catch(() => setInstitutions([])); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (demo) { setErr('โหมดตัวอย่าง: ไม่มีการบันทึกหรือส่งข้อมูล'); return; }
    setBusy(true); setErr('');
    const r = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fullName, nickname, institution, phone, birthDate, consent, confirm: true }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(d.error || 'บันทึกไม่สำเร็จ'); setBusy(false); return; }
    router.replace('/rules'); router.refresh();
  }

  return (
    <main className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-slate-900/45 p-2 sm:p-5">
      <form onSubmit={submit} className="h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/70 bg-white p-2.5 shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-3xl sm:p-4">
        <div className="mb-2 flex items-start justify-between gap-2 sm:mb-4 sm:gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 sm:text-xs">Identity verification</p>
            <h1 className="mt-0.5 text-xl font-bold text-slate-900 sm:mt-1 sm:text-2xl">สรุปข้อมูลและยืนยันตัวตน</h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:mt-1 sm:text-sm">ตรวจสอบข้อมูลเดิม แก้ไขเฉพาะช่องที่ต้องการ แล้วกดบันทึก</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {demo && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800 sm:px-3 sm:text-xs">ตัวอย่าง</span>}
            {!demo && <div className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 sm:px-3 sm:text-xs">OTP ผ่านแล้ว</div>}
            {demo && <button type="button" onClick={() => router.push('/demo')} aria-label="ปิดตัวอย่าง" title="ปิดตัวอย่าง" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xl leading-none text-slate-500 hover:bg-slate-100">×</button>}
          </div>
        </div>

        <div className="mb-2 rounded-xl bg-slate-50 px-3 py-1.5 text-xs text-slate-700 sm:mb-2 sm:px-4 sm:py-2 sm:text-sm">
          <span className="text-slate-500">Email ที่ใช้ยืนยัน</span>
          <div className="mt-0.5 break-all font-semibold text-slate-900">{initial.email}</div>
        </div>

        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 sm:mb-3 sm:text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> ข้อมูลของคุณ
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          <label className="col-span-2 text-xs text-slate-700 sm:text-sm">ชื่อ-นามสกุล
            <input className="input mt-1 !px-2.5 !py-0.5 text-sm sm:!px-3 sm:!py-1" required placeholder="เช่น นายสมชาย ใจดี" value={fullName} onChange={(e) => { setFullName(e.target.value); setErr(''); }} />
          </label>
          {initial.role !== 'Teacher' && <label className="col-span-2 text-xs text-slate-700 sm:text-sm">ชื่อเล่น
            <input className="input mt-1 !px-2.5 !py-0.5 text-sm sm:!px-3 sm:!py-1" value={nickname} placeholder="เช่น พลับ" onChange={(e) => { setNickname(e.target.value); setErr(''); }} />
          </label>}
          <label className="col-span-2 text-xs text-slate-700 sm:text-sm">สถานศึกษา
            <input className="input mt-1 !px-2.5 !py-0.5 text-sm sm:!px-3 sm:!py-1" required list="institution-options" value={institution} placeholder="พิมพ์เพื่อค้นหาสถานศึกษา" onChange={(e) => { setInstitution(e.target.value); setErr(''); }} />
            <datalist id="institution-options">{institutions.map((item) => <option key={item} value={item} />)}</datalist>
          </label>
          {initial.role !== 'Teacher' && <label className="col-span-2 text-xs text-slate-700 sm:text-sm">ระดับชั้น
            <input className="input mt-1 bg-slate-50 !px-2.5 !py-0.5 text-sm sm:!px-3 sm:!py-1" readOnly value={initial.level || '-'} />
          </label>}
          <label className="text-xs text-slate-700 sm:text-sm">เบอร์โทรศัพท์
            <input className="input mt-1 !px-2.5 !py-0.5 text-sm sm:!px-3 sm:!py-1" required inputMode="numeric" maxLength={10} pattern="0[0-9]{9}" placeholder="0xxxxxxxxx" value={phone} onChange={(e) => { const digits = e.target.value.replace(/\D/g, '').slice(0, 10); setPhone(digits && !digits.startsWith('0') ? `0${digits.slice(0, 9)}` : digits); setErr(''); }} />
          </label>
          {initial.role !== 'Teacher' && <label className="text-xs text-slate-700 sm:text-sm">วันเดือนปีเกิด
            <input className="input mt-1 !px-2.5 !py-0.5 text-sm sm:!px-3 sm:!py-1" required placeholder={initial.birthMasked || 'เช่น 16-12-2547'} value={birthDate} onChange={(e) => { setBirthDate(e.target.value); setErr(''); }} />
          </label>}
          {initial.role !== 'Teacher' && <label className="text-xs text-slate-700 sm:text-sm">วันที่เริ่มฝึกงาน
            <input className="input mt-1 cursor-not-allowed !bg-slate-100 !px-2.5 !py-0.5 text-sm text-slate-600 sm:!px-3 sm:!py-1" value={initial.startDate || '-'} readOnly aria-readonly="true" />
          </label>}
          {initial.role !== 'Teacher' && <label className="text-xs text-slate-700 sm:text-sm">วันที่สิ้นสุดฝึกงาน
            <input className="input mt-1 cursor-not-allowed !bg-slate-100 !px-2.5 !py-0.5 text-sm text-slate-600 sm:!px-3 sm:!py-1" value={initial.endDate || '-'} readOnly aria-readonly="true" />
          </label>}
        </div>

        <details className="group mt-3 overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/80 sm:mt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-emerald-900 marker:hidden sm:px-4 sm:py-2.5">
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-700" aria-hidden="true">i</span>
              <span>แจ้งการเก็บข้อมูลส่วนบุคคล (PDPA)</span>
            </span>
            <span className="text-xs text-emerald-700 transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
          </summary>
          <div className="space-y-2 border-t border-emerald-100 px-3 py-3 text-xs leading-5 text-slate-600 sm:px-4 sm:py-3 sm:text-sm sm:leading-6">
            <p>ระบบเก็บชื่อ เลขบัตรประชาชน อีเมล เบอร์โทรศัพท์ วันเกิด และข้อมูลการฝึกงาน เพื่อยืนยันตัวตนประสานงานและบริหารจัดการการฝึกงาน</p>
            <p>หากยังอยู่ระหว่างการฝึกงานจะเก็บข้อมูลไว้จนสิ้นสุดระยะเวลาการฝึกงาน และเก็บต่อไม่เกิน 3 เดือนเท่าที่จำเป็นหลังจากนั้นจะลบหรือทำให้ไม่สามารถระบุตัวบุคคลได้เว้นแต่มีหน้าที่ตามกฎหมายให้ต้องเก็บต่อ</p>
            <p>การเก็บใช้เปิดเผยและรักษาความปลอดภัยข้อมูลดำเนินการตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 รวมถึงหลักการแจ้งวัตถุประสงค์ฐานการประมวลผลสิทธิของเจ้าของข้อมูลและมาตรการรักษาความมั่นคงปลอดภัยตามกฎหมาย</p>
          </div>
        </details>

        <label className="mt-2 flex items-start gap-2 text-xs leading-4 text-slate-700 sm:mt-3 sm:text-sm sm:leading-5">
          <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>ข้าพเจ้าอ่านและยินยอมให้เก็บและประมวลผลข้อมูลตามรายละเอียดข้างต้น</span>
        </label>
        {err && <p className="mt-3 text-sm text-red-600" role="alert">{err}</p>}
        <button className="btn mt-2 w-full sm:mt-3" disabled={busy || !consent}>{demo ? 'ทดลองยืนยันข้อมูล' : busy ? 'กำลังบันทึก...' : 'บันทึกข้อมูลและยืนยันตัวตน'}</button>
      </form>
    </main>
  );
}
