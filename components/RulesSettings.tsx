'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RULE_ROLES, type RuleRole } from '@/content/rules';
import type { ManagedRuleSet, ManagedRuleItem } from '@/lib/managed-rules';
import RulesView from '@/components/RulesView';

const ROLE_LABELS: Record<RuleRole, string> = { Intern: 'Intern', DVE: 'DVE', Teacher: 'Teacher' };
type HistoryItem = { timestamp: string; role: RuleRole; version: string; editorEmail: string };

export default function RulesSettings() {
  const [all, setAll] = useState<Record<RuleRole, ManagedRuleSet> | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [role, setRole] = useState<RuleRole>('Intern');
  const [preview, setPreview] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const previewScroller = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setError('');
    const response = await fetch('/api/admin/rules', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'โหลดกฎไม่สำเร็จ');
    setAll(data.rules);
    setHistory(data.history || []);
  }, []);

  useEffect(() => { refresh().catch((e) => setError(e.message)); }, [refresh]);
  useEffect(() => {
    if (!preview && !addItemOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (addItemOpen) setAddItemOpen(false);
      else setPreview(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape); };
  }, [preview, addItemOpen]);

  useEffect(() => {
    if (!preview) return;
    const frame = window.requestAnimationFrame(() => previewScroller.current?.scrollTo({ top: 0 }));
    return () => window.cancelAnimationFrame(frame);
  }, [preview, role]);

  const current = all?.[role];
  function update(patch: Partial<ManagedRuleSet>) {
    setAll((prev) => prev ? { ...prev, [role]: { ...prev[role], ...patch } } : prev);
    setMessage(''); setError('');
  }
  function updateItem(index: number, patch: Partial<ManagedRuleItem>) {
    if (!current) return;
    update({ items: current.items.map((item, i) => i === index ? { ...item, ...patch } : item) });
  }
  function moveItem(index: number, direction: -1 | 1) {
    if (!current) return;
    const target = index + direction;
    if (target < 0 || target >= current.items.length) return;
    const items = [...current.items];
    [items[index], items[target]] = [items[target], items[index]];
    update({ items });
  }
  function addItem() {
    if (!current || !newItemText.trim()) return;
    const newItem = { text: newItemText.trim(), enabled: true };
    const items = [...current.items];
    const insertAt = current.futurePlanRequired ? Math.max(0, items.length - 1) : items.length;
    items.splice(insertAt, 0, newItem);
    update({ items });
    setNewItemText('');
    setAddItemOpen(false);
  }
  async function save() {
    if (!current) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/rules', {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role, rule: current }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'บันทึกกฎไม่สำเร็จ');
      setAll((prev) => prev ? { ...prev, [role]: data.rule } : prev);
      setHistory((prev) => [{ timestamp: data.rule.updatedAtIso || new Date().toISOString(), role, version: String(data.rule.version), editorEmail: data.rule.updatedBy || 'คุณ' }, ...prev].slice(0, 100));
      setMessage(`บันทึกกฎ ${ROLE_LABELS[role]} แล้ว · เวอร์ชัน ${data.rule.version}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'บันทึกกฎไม่สำเร็จ'); }
    finally { setBusy(false); }
  }

  if (!all || !current) return <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">{error || 'กำลังโหลดการตั้งค่ากฎระเบียบ…'}</div>;

  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl font-bold">จัดการกฎระเบียบ</h1><p className="mt-1 text-sm text-slate-600">แก้ไขกฎแยกตามบทบาท ควบคุมการแสดงผล และตรวจตัวอย่างก่อนบันทึก</p></div>
    </header>

    <div className="flex flex-wrap gap-2" role="tablist" aria-label="เลือกบทบาท">
      {RULE_ROLES.map((entry) => <button key={entry} type="button" role="tab" aria-selected={role === entry} onClick={() => setRole(entry)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${role === entry ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{ROLE_LABELS[entry]}</button>)}
    </div>

    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
        <div><p className="font-semibold">แสดงกฎชุดนี้ให้ผู้ใช้เห็น</p><p className="text-xs text-slate-500">เมื่อปิด ผู้ใช้ในบทบาทนี้จะเห็นข้อความแจ้งว่ากฎยังไม่เปิดให้รับทราบ</p></div>
        <input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={current.enabled} onChange={(e) => update({ enabled: e.target.checked })} aria-label="เปิดแสดงกฎชุดนี้" />
      </div>
      <label className="block text-sm font-semibold">ชื่อหน้า<input className="input mt-1 font-normal" maxLength={160} value={current.title} onChange={(e) => update({ title: e.target.value })} /></label>
      <label className="block text-sm font-semibold">ชื่อบทบาทที่แสดง<input className="input mt-1 font-normal" maxLength={120} value={current.roleLabel} onChange={(e) => update({ roleLabel: e.target.value })} /></label>
      <label className="block text-sm font-semibold">ข้อความนำ<textarea className="input mt-1 min-h-20 font-normal" maxLength={2000} value={current.intro || ''} onChange={(e) => update({ intro: e.target.value })} /></label>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2"><h2 className="font-bold">รายการกฎ</h2><button type="button" onClick={() => { setNewItemText(''); setAddItemOpen(true); }} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-sm font-semibold text-emerald-800">+ เพิ่มข้อ</button></div>
        {current.items.map((item, index) => <article key={index} className={`rounded-xl border p-3 ${item.enabled ? 'border-slate-200' : 'border-amber-200 bg-amber-50/60'}`}>
          <div className="flex items-start gap-2"><span className="mt-2 w-7 shrink-0 text-center text-sm font-bold text-slate-500">{index + 1}</span><textarea className="input min-h-20 flex-1" value={item.text} onChange={(e) => updateItem(index, { text: e.target.value })} aria-label={`ข้อความกฎข้อ ${index + 1}`} /><div className="flex flex-col gap-1"><button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} className="rounded border px-2 py-1 text-xs disabled:opacity-30" aria-label="เลื่อนขึ้น">↑</button><button type="button" onClick={() => moveItem(index, 1)} disabled={index === current.items.length - 1} className="rounded border px-2 py-1 text-xs disabled:opacity-30" aria-label="เลื่อนลง">↓</button><button type="button" onClick={() => updateItem(index, { enabled: !item.enabled })} disabled={Boolean(current.futurePlanRequired) && index === current.items.length - 1} className={`rounded border px-2 py-1 text-xs disabled:opacity-40 ${item.enabled ? 'text-amber-800' : 'text-emerald-800'}`}>{item.enabled ? 'ซ่อน' : 'แสดง'}</button><button type="button" disabled={Boolean(current.futurePlanRequired) && index === current.items.length - 1} onClick={() => update({ items: current.items.filter((_, i) => i !== index) })} className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700 disabled:opacity-40">ลบ</button></div></div>
        </article>)}
      </div>

      {role !== 'Teacher' && <section className="space-y-3 rounded-xl border border-slate-200 p-4">
        <label className="flex items-center gap-3 font-semibold"><input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={Boolean(current.futurePlanRequired)} onChange={(e) => update({ futurePlanRequired: e.target.checked })} />ให้ตอบคำถามแผนหลังฝึกงาน</label>
        {current.futurePlanRequired && <div className="space-y-2">{(current.futurePlanOptions || []).map((option, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_auto]"><input className="input" aria-label={`ข้อความตัวเลือก ${index + 1}`} placeholder="ข้อความตัวเลือกที่ผู้ใช้เห็นและระบบบันทึก" value={option.label} onChange={(e) => update({ futurePlanOptions: current.futurePlanOptions?.map((value, i) => i === index ? { label: e.target.value, value: e.target.value } : value) })} /><button type="button" onClick={() => update({ futurePlanOptions: current.futurePlanOptions?.filter((_, i) => i !== index) })} className="rounded-lg border border-rose-200 px-3 text-sm text-rose-700">ลบ</button></div>)}<button type="button" onClick={() => update({ futurePlanOptions: [...(current.futurePlanOptions || []), { label: '', value: '' }] })} className="rounded-lg border px-3 py-1.5 text-sm">+ เพิ่มตัวเลือก</button><p className="text-xs text-slate-500">ข้อความที่แสดงจะเป็นค่าคำตอบที่จัดเก็บด้วย ระบบยังแสดงและรวมคำตอบเก่ากับข้อความใหม่ในรายงาน</p></div>}
      </section>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-xs text-slate-500">เวอร์ชันปัจจุบัน {current.version} · บันทึกแล้วจะทำให้ผู้ใช้รับทราบกฎฉบับใหม่อีกครั้ง</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setPreview(true)} className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">ดูตัวอย่าง</button><button type="button" onClick={save} disabled={busy} className="btn min-w-32">{busy ? 'กำลังบันทึก…' : 'บันทึกกฎ'}</button></div></div>
      {message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
    </section>

    {preview && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(false); }}><section className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-slate-50 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="rules-preview-title"><header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6"><div><h2 id="rules-preview-title" className="font-bold text-slate-900">ตัวอย่างหน้าที่ผู้ใช้จะเห็น</h2><p className="text-xs text-slate-600">{ROLE_LABELS[role]} · ดูรายละเอียดกฎและคำถามก่อนบันทึก</p></div><button type="button" autoFocus onClick={() => setPreview(false)} aria-label="ปิดตัวอย่าง" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-xl text-slate-600 hover:bg-slate-100">×</button></header><div ref={previewScroller} className="overflow-y-auto overscroll-contain bg-white"><RulesView rules={current} storageScope={`admin-preview:${role}`} persistProgress={false} /></div></section></div>}
    {addItemOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddItemOpen(false); }}><section className="w-full max-w-lg rounded-2xl border border-emerald-100 bg-white p-5 shadow-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="add-rule-title"><div className="flex items-start justify-between gap-3"><div><h2 id="add-rule-title" className="text-lg font-bold">เพิ่มข้อกฎ</h2><p className="mt-1 text-sm text-slate-600">กรอกข้อความที่ต้องการให้ผู้ใช้เห็น</p></div><button type="button" onClick={() => setAddItemOpen(false)} aria-label="ปิดหน้าต่างเพิ่มข้อ" className="flex h-8 w-8 items-center justify-center rounded-full border text-lg text-slate-600 hover:bg-slate-100">×</button></div><textarea autoFocus className="input mt-4 min-h-32" placeholder="พิมพ์ข้อความกฎระเบียบ" value={newItemText} onChange={(event) => setNewItemText(event.target.value)} /><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setAddItemOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">ยกเลิก</button><button type="button" onClick={addItem} disabled={!newItemText.trim()} className="btn">เพิ่มข้อ</button></div></section></div>}
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-bold">ประวัติการแก้ไข</h2><p className="mt-1 text-xs text-slate-500">แสดง 100 รายการล่าสุด พร้อมผู้แก้ไขและหมายเลขเวอร์ชัน</p><div className="mt-3 divide-y">{history.filter((item) => item.role === role).map((item, index) => <div key={`${item.timestamp}-${index}`} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>เวอร์ชัน {item.version} · {item.editorEmail}</span><time className="text-slate-500">{new Date(item.timestamp).toLocaleString('th-TH')}</time></div>)}{!history.some((item) => item.role === role) && <p className="py-3 text-sm text-slate-500">ยังไม่มีประวัติการแก้ไข</p>}</div></section>
  </div>;
}
