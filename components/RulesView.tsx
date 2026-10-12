'use client';

import { useEffect, useState } from 'react';
import type { RuleSet } from '@/content/rules';
import { signOut } from 'next-auth/react';
import FeedbackModal from '@/components/FeedbackModal';

export default function RulesView({ rules, storageScope = 'user', serverConsented = false, serverFuturePlan = '', serverFutureReason = '', persistProgress = true }: { rules: RuleSet; storageScope?: string; serverConsented?: boolean; serverFuturePlan?: string; serverFutureReason?: string; persistProgress?: boolean }) {
  // เก็บสถานะ "อ่านแล้ว" ในเครื่อง และรีเซ็ตเมื่อมีการอัปเดตกฎ (updatedAt เปลี่ยน)
  const storageKey = `${storageScope}:rules-read:${rules.title}:${rules.updatedAt}`;
  const consentKey = `${storageScope}:rules-consented:${rules.title}:${rules.updatedAt}`;
  const [read, setRead] = useState<boolean[]>(() => rules.items.map(() => false));
  const [consented, setConsented] = useState(false);
  const [ready, setReady] = useState(false);
  const [futurePlan, setFuturePlan] = useState('');
  const [futureReason, setFutureReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [completionOpen, setCompletionOpen] = useState(false);

  useEffect(() => {
    setRead(rules.items.map(() => false));
    setFuturePlan(serverFuturePlan);
    setFutureReason(serverFutureReason);
    setError('');
    try {
      if (persistProgress) {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const saved = JSON.parse(raw) as boolean[];
          if (Array.isArray(saved) && saved.length === rules.items.length) setRead(saved);
        }
      }
      // สถานะรับทราบที่ใช้แสดงใน Admin ต้องยึดจากฐานข้อมูล ไม่ใช้ localStorage อย่างเดียว
      setConsented(serverConsented && (!rules.futurePlanRequired || Boolean(serverFuturePlan)));
    } catch {}
    setReady(true);
  }, [storageKey, rules.items.length, serverConsented, serverFuturePlan, serverFutureReason, rules.futurePlanRequired, persistProgress]);

  function toggle(i: number) {
    if (consented) return;
    setRead((prev) => {
      const next = prev.map((v, idx) => (idx === i ? !v : v));
      if (persistProgress) try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  async function agree() {
    if (!allDone || consented || saving) {
      if (rules.futurePlanRequired && futurePlan === 'ไม่สนใจ' && !futureReason.trim()) setError('กรุณากรอกเหตุผล');
      else if (rules.futurePlanRequired && !futurePlan) setError('กรุณาเลือกความประสงค์หลังสำเร็จการฝึกงาน');
      return;
    }
    setSaving(true); setError('');
    if (!persistProgress) { setConsented(true); setCompletionOpen(true); setSaving(false); return; }
    const response = await fetch('/api/me', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rulesConsent: true, rulesFuturePlan: futurePlan, rulesReason: futureReason }),
    }).catch(() => null);
    if (!response?.ok) {
      const data = await response?.json().catch(() => ({}));
      setError(data?.error || 'บันทึกการรับทราบกฎระเบียบไม่สำเร็จ'); setSaving(false); return;
    }
    setConsented(true);
    if (persistProgress) try { localStorage.setItem(consentKey, 'true'); } catch {}
    setCompletionOpen(true);
    setSaving(false);
  }

  async function signOutAfterCompletion() {
    try { await signOut({ redirect: false }); }
    finally { window.location.replace('/login'); }
  }

  function selectAll() {
    if (consented) return;
    const next = rules.items.map(() => true);
    setRead(next);
    if (persistProgress) try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  }

  const total = rules.items.length;
  const teacherRules = rules.roleLabel === 'อาจารย์ที่ปรึกษา';
  const done = read.filter(Boolean).length;
  const futurePlanValid = !rules.futurePlanRequired || (Boolean(futurePlan) && (futurePlan !== 'ไม่สนใจ' || futureReason.trim().length > 0));
  const allDone = ready && done === total && futurePlanValid;

  return (
    <>
    <section className="mx-auto max-w-3xl px-4 pb-32 pt-5 sm:px-6 sm:pt-10">
      {/* Hero */}
      <div className="rounded-[28px] bg-emerald-700 p-6 text-white shadow-lg shadow-emerald-900/10 sm:p-8">
        <p className="text-xs font-semibold text-emerald-100">คู่มือการฝึกงาน</p>
        <h1 className="mt-2 text-[28px] font-bold leading-snug sm:text-3xl">{rules.title}</h1>
        <p className="mt-4 inline-flex rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium">
          อ่านให้ครบก่อนเริ่มงาน
        </p>
        <p className="mt-5 text-[15px] text-emerald-50">
          {rules.roleLabel} <span className="mx-1.5 text-emerald-200">•</span> อัปเดต {rules.updatedAt}
        </p>
      </div>

      {/* Heading + progress */}
      <div className="mt-8 flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-xl font-bold text-slate-900">สิ่งที่ควรรู้</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">
            กรุณาปฏิบัติตามกฎระเบียบตลอดระยะเวลาฝึกงาน
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-[13px] font-semibold text-emerald-700">
          {ready ? `${done}/${total}` : `${total}`} ข้อ
        </span>
      </div>

      <div
        className="mx-1 mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label="จำนวนกฎที่อ่านแล้ว"
      >
        <div
          className="h-full rounded-full bg-emerald-600 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${total ? (done / total) * 100 : 0}%` }}
        />
      </div>

      {/* Rules */}
      <ol className="mt-4 space-y-3">
        {rules.items.map((text, i) => {
          const isRead = read[i];
          if (rules.futurePlanRequired && i === rules.items.length - 1) return (
            <li key={i} className={`rounded-3xl border p-4 shadow-sm sm:p-5 ${isRead ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-start gap-4">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-bold ring-1 ${isRead ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-emerald-50 text-emerald-700 ring-emerald-100'}`}>{isRead ? '✓' : i + 1}</span>
                <div className="min-w-0 flex-1 pt-1.5 text-[15px] leading-7 text-slate-700 sm:text-base">
                  <p>{text}</p>
                  <div className="mt-3 space-y-2 text-sm leading-6">
                    {['สนใจทำงานต่อเนื่อง', 'สนใจทำงานต่อและต้องการศึกษาต่อ (หากบริษัทมีโครงการเรียนต่อไปด้วยทำงานไปด้วยร่วมกับบริษัท)', 'ไม่สนใจ'].map((option) => <label key={option} className="flex items-start gap-2"><input type="radio" name="future-plan" value={option} checked={futurePlan === option} disabled={consented} onChange={() => { setFuturePlan(option); setRead((prev) => prev.map((v, idx) => idx === i ? true : v)); }} className="mt-1 accent-emerald-600" /><span>{option}</span></label>)}
                    {!futurePlan && <p className="text-xs font-medium text-red-600" role="alert">กรุณาเลือกคำตอบในข้อนี้</p>}
                    {futurePlan === 'ไม่สนใจ' && <><textarea required={!consented} disabled={consented} className="input min-h-20" placeholder="กรุณาระบุเหตุผล" value={futureReason} onChange={(e) => { setFutureReason(e.target.value); setError(''); }} /><p className="text-xs font-medium text-red-600">{!futureReason.trim() && 'กรุณากรอกเหตุผล'}</p></>}
                  </div>
                </div>
              </div>
            </li>
          );
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={isRead}
                className={`flex w-full items-start gap-4 rounded-3xl border p-4 text-left shadow-sm transition active:scale-[0.98] motion-reduce:transition-none sm:p-5 ${
                  isRead
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-slate-200 bg-white [@media(hover:hover)]:hover:border-emerald-200'
                } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-bold ring-1 ${
                    isRead
                      ? 'bg-emerald-600 text-white ring-emerald-600'
                      : 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                  }`}
                >
                  {isRead ? '✓' : i + 1}
                </span>
                <span className="min-w-0 flex-1 pt-1.5 text-[15px] leading-7 text-slate-700 sm:text-base">
                  {teacherRules ? <span className="block space-y-1">{text.split('\n').map((line, lineIndex) => lineIndex === 0 ? <strong key={lineIndex} className="block text-base text-slate-900">{line}</strong> : <span key={lineIndex} className="block whitespace-pre-line">{line}</span>)}</span> : text}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <p
        className={`mt-6 text-center text-[13px] ${allDone ? 'font-medium text-emerald-700' : 'text-slate-400'}`}
        aria-live="polite"
      >
        {allDone
          ? 'อ่านครบทุกข้อแล้ว กรุณาตรวจสอบและยืนยันการยินยอมด้านล่าง'
          : 'โปรดอ่านกฎระเบียบทุกข้อโดยละเอียดก่อนทำเครื่องหมายยืนยัน'}
      </p>
      <div className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-700">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0 accent-emerald-600"
            checked={allDone}
            disabled={consented}
            onChange={(e) => {
              if (e.target.checked) selectAll();
              else if (!consented) {
                const next = rules.items.map(() => false);
                setRead(next);
                try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
              }
            }}
          />
          <span>ข้าพเจ้ารับรองว่าได้อ่านและยินยอมปฏิบัติตามกฎระเบียบทุกข้อที่ระบุไว้ข้างต้น</span>
        </label>
        <button type="button" onClick={agree} disabled={!allDone || consented || saving} className="btn mt-3 w-full disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">
          {saving ? 'กำลังบันทึก...' : consented ? 'รับทราบกฎระเบียบเรียบร้อยแล้ว' : 'ยืนยันการรับทราบกฎระเบียบ'}
        </button>
        {error && <p className="mt-2 text-center text-xs font-medium text-red-600" role="alert">{error}</p>}
        {consented && <p className="mt-2 text-center text-xs font-medium text-emerald-700">รับทราบแล้ว ไม่สามารถยกเลิกการเลือกกฎระเบียบได้</p>}
      </div>
    </section>
    {completionOpen && <FeedbackModal title="เสร็จสิ้นแล้ว" message="บันทึกการยินยอมเรียบร้อยแล้ว คุณสามารถออกจากระบบได้" tone="success" actionLabel="ออกจากระบบ" onClose={signOutAfterCompletion} onCancel={() => setCompletionOpen(false)} cancelLabel="อยู่ในระบบต่อ" />}
    </>
  );
}
