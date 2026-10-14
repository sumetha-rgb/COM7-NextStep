'use client';

import { useEffect, useState } from 'react';
import type { RuleSet } from '@/content/rules';
import { signOut } from 'next-auth/react';
import FeedbackModal from '@/components/FeedbackModal';

type VisibleRuleItem = { text: string; enabled: boolean };
function visibleRules(rules: RuleSet): VisibleRuleItem[] {
  return rules.items.map((item) => typeof item === 'string' ? { text: item, enabled: true } : { text: item.text, enabled: item.enabled !== false }).filter((item) => item.enabled);
}
function isNotInterestedPlan(value: string) { return value === 'ไม่สนใจทำงานต่อ' || value === 'ไม่สนใจ'; }

export default function RulesView({ rules, storageScope = 'user', serverConsented = false, serverFuturePlan = '', serverFutureReason = '', persistProgress = true }: { rules: RuleSet; storageScope?: string; serverConsented?: boolean; serverFuturePlan?: string; serverFutureReason?: string; persistProgress?: boolean }) {
  const items = visibleRules(rules);
  // เก็บสถานะ "อ่านแล้ว" ในเครื่อง และรีเซ็ตเมื่อมีการอัปเดตกฎ (updatedAt เปลี่ยน)
  const storageKey = `${storageScope}:rules-read:${rules.title}:${rules.version || rules.updatedAt}`;
  const consentKey = `${storageScope}:rules-consented:${rules.title}:${rules.version || rules.updatedAt}`;
  const [read, setRead] = useState<boolean[]>(() => items.map(() => false));
  const [consented, setConsented] = useState(false);
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [ready, setReady] = useState(false);
  const [futurePlan, setFuturePlan] = useState('');
  const [futureReason, setFutureReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [completionOpen, setCompletionOpen] = useState(false);

  useEffect(() => {
    setFuturePlan(serverFuturePlan);
    setFutureReason(serverFutureReason);
    setAgreementChecked(false);
    setError('');
    const alreadyAcknowledged = serverConsented && (!rules.futurePlanRequired || Boolean(serverFuturePlan));
    let savedRead: boolean[] | null = null;
    try {
      if (persistProgress) {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const saved = JSON.parse(raw) as boolean[];
          if (Array.isArray(saved) && saved.length === items.length) savedRead = saved;
        }
      }
      // สถานะรับทราบที่ใช้แสดงใน Admin ต้องยึดจากฐานข้อมูล ไม่ใช้ localStorage อย่างเดียว
    } catch {}
    // ถ้ารับทราบเวอร์ชันนี้แล้ว ให้ UI แสดงทุกข้อครบ แม้ localStorage ในอุปกรณ์นี้จะว่าง
    setRead(alreadyAcknowledged ? items.map(() => true) : savedRead || items.map(() => false));
    setConsented(alreadyAcknowledged);
    setReady(true);
  }, [storageKey, items.length, serverConsented, serverFuturePlan, serverFutureReason, rules.futurePlanRequired, persistProgress]);

  function toggle(i: number) {
    if (consented) return;
    setRead((prev) => {
      const next = prev.map((v, idx) => (idx === i ? !v : v));
      setAgreementChecked(false);
      if (persistProgress) try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  async function agree() {
    if (!allDone || !agreementChecked || consented || saving) {
      if (rules.futurePlanRequired && isNotInterestedPlan(futurePlan) && !futureReason.trim()) setError('กรุณากรอกเหตุผล');
      else if (rules.futurePlanRequired && !futurePlan) setError('กรุณาเลือกความประสงค์หลังสำเร็จการฝึกงาน');
      else if (allDone && !agreementChecked) setError('กรุณาทำเครื่องหมายยืนยันด้วยตนเองก่อนบันทึก');
      return;
    }
    setSaving(true); setError('');
    if (!persistProgress) { setConsented(true); setCompletionOpen(true); setSaving(false); return; }
    const response = await fetch('/api/me', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rulesConsent: true, rulesFuturePlan: futurePlan, rulesReason: futureReason, rulesVersion: rules.version || 1 }),
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

  function setAllRules(checked: boolean) {
    if (consented) return;
    setAgreementChecked(checked);
    const next = items.map(() => checked);
    setRead(next);
    if (persistProgress) try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  }

  const total = items.length;
  const defaultFuturePlanOptions = [
    { label: 'สนใจทำงานต่อ', value: 'สนใจทำงานต่อ' },
    { label: 'สนใจทำงานต่อและต้องการศึกษาต่อ (หากบริษัทมีโครงการเรียนต่อไปด้วยทำงานไปด้วยร่วมกับบริษัท)', value: 'สนใจทำงานต่อและต้องการศึกษาต่อ (หากบริษัทมีโครงการเรียนต่อไปด้วยทำงานไปด้วยร่วมกับบริษัท)' },
    { label: 'ไม่สนใจทำงานต่อ', value: 'ไม่สนใจทำงานต่อ' },
  ];
  const futurePlanOptions = rules.futurePlanOptions || defaultFuturePlanOptions;
  const visibleFuturePlanOptions = futurePlan && !futurePlanOptions.some((option) => option.value === futurePlan)
    ? [...futurePlanOptions, { label: futurePlan, value: futurePlan }]
    : futurePlanOptions;
  const teacherRules = rules.roleLabel === 'อาจารย์ที่ปรึกษา';
  const done = read.filter(Boolean).length;
  const allRead = ready && done === total;
  const futurePlanValid = !rules.futurePlanRequired || (Boolean(futurePlan) && (!isNotInterestedPlan(futurePlan) || futureReason.trim().length > 0));
  const allDone = allRead && futurePlanValid;

  return (
    <>
    <section className="mx-auto max-w-3xl px-4 pb-32 pt-5 sm:px-6 sm:pt-10">
      {/* Hero */}
      {rules.enabled === false ? <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950"><h1 className="text-xl font-bold">กฎระเบียบยังไม่เปิดให้รับทราบ</h1><p className="mt-2 text-sm leading-6">กรุณาติดต่อผู้ดูแลระบบหรือกลับมาใหม่ภายหลัง</p></div> : <>
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

      {rules.intro && <p className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-slate-700">{rules.intro}</p>}

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
        {items.map(({ text }, i) => {
          const isRead = read[i];
          if (rules.futurePlanRequired && i === items.length - 1) return (
            <li key={i} className={`rounded-3xl border p-4 shadow-sm sm:p-5 ${isRead ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-start gap-4">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-bold ring-1 ${isRead ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-emerald-50 text-emerald-700 ring-emerald-100'}`}>{isRead ? '✓' : i + 1}</span>
                <div className="min-w-0 flex-1 pt-1.5 text-[15px] leading-7 text-slate-700 sm:text-base">
                  <p>{text}</p>
                  <div className="mt-3 space-y-2 text-sm leading-6">
                    {visibleFuturePlanOptions.map((option) => <label key={option.value} className="flex items-start gap-2"><input type="radio" name="future-plan" value={option.value} checked={futurePlan === option.value} disabled={consented} onChange={() => { setFuturePlan(option.value); setAgreementChecked(false); setRead((prev) => prev.map((v, idx) => idx === i ? true : v)); }} className="mt-1 accent-emerald-600" /><span>{option.label}</span></label>)}
                    {!futurePlan && <p className="text-xs font-medium text-red-600" role="alert">กรุณาเลือกคำตอบในข้อนี้</p>}
                    {isNotInterestedPlan(futurePlan) && <><textarea required={!consented} disabled={consented} className="input min-h-20" placeholder="กรุณาระบุเหตุผล" value={futureReason} onChange={(e) => { setFutureReason(e.target.value); setAgreementChecked(false); setError(''); }} /><p className="text-xs font-medium text-red-600">{!futureReason.trim() && 'กรุณากรอกเหตุผล'}</p></>}
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
                disabled={consented}
                title={consented ? 'รับทราบกฎระเบียบเวอร์ชันนี้แล้ว' : 'กดเพื่อทำเครื่องหมายว่าอ่านข้อนี้แล้ว'}
                className={`flex w-full items-start gap-4 rounded-3xl border p-4 text-left shadow-sm transition active:scale-[0.98] motion-reduce:transition-none sm:p-5 ${
                  isRead
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-slate-200 bg-white [@media(hover:hover)]:hover:border-emerald-200'
                } ${consented ? 'cursor-default' : 'cursor-pointer'} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600`}
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

      <p className={`mt-6 text-center text-[13px] ${allDone ? 'font-medium text-emerald-700' : 'text-slate-400'}`} aria-live="polite">
        {!allRead ? 'โปรดอ่านกฎระเบียบทุกข้อโดยละเอียดก่อนทำเครื่องหมายยืนยัน' : !futurePlanValid ? 'กรุณาตอบคำถามท้ายกฎระเบียบให้ครบก่อนยืนยัน' : agreementChecked ? 'ทำเครื่องหมายยืนยันแล้ว กรุณากดยืนยันเพื่อบันทึก' : 'อ่านครบทุกข้อแล้ว กรุณาทำเครื่องหมายยืนยันด้านล่าง'}
      </p>
      <div className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
        {consented ? <p role="status" className="rounded-xl bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-800">✓ รับทราบกฎระเบียบเวอร์ชันนี้แล้ว</p> : <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-700">
          <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-emerald-600" checked={agreementChecked} disabled={!ready} onChange={(e) => setAllRules(e.target.checked)} />
          <span>ข้าพเจ้ารับรองว่าได้อ่านและยินยอมปฏิบัติตามกฎระเบียบทุกข้อที่ระบุไว้ข้างต้น</span>
        </label>}
        <button type="button" onClick={agree} disabled={!allDone || !agreementChecked || consented || saving} className="btn mt-3 w-full disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">
          {saving ? 'กำลังบันทึก...' : consented ? 'รับทราบกฎระเบียบเรียบร้อยแล้ว' : 'ยืนยันการรับทราบกฎระเบียบ'}
        </button>
        {error && <p className="mt-2 text-center text-xs font-medium text-red-600" role="alert">{error}</p>}
        {consented && <p className="mt-2 text-center text-xs font-medium text-emerald-700">รับทราบแล้ว ไม่สามารถยกเลิกการเลือกกฎระเบียบได้</p>}
      </div>
      </>}
    </section>
    {completionOpen && <FeedbackModal title="เสร็จสิ้นแล้ว" message="บันทึกการยินยอมเรียบร้อยแล้ว คุณสามารถออกจากระบบได้" tone="success" actionLabel="ออกจากระบบ" onClose={signOutAfterCompletion} onCancel={() => setCompletionOpen(false)} cancelLabel="อยู่ในระบบต่อ" />}
    </>
  );
}
