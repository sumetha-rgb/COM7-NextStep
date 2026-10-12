'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

type A = { timestamp: string; editorEmail: string; editorName?: string; editorRole: string; targetEmail: string; field: string; oldValue: string; newValue: string; action: string; note: string };
const FIELDS: [string, string][] = [['fullName', 'ชื่อ-นามสกุล'], ['nickname', 'ชื่อเล่น'], ['institution', 'สถานศึกษา'], ['phone', 'เบอร์โทร'], ['birthDate', 'วันเกิด'], ['status', 'สถานะ'], ['role', 'บทบาท']];

export default function AuditTable() {
  const [f, setF] = useState({ target: '', editor: '', field: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: A[]; total: number; pageSize: number }>({ rows: [], total: 0, pageSize: 20 });
  const [err, setErr] = useState('');
  const applied = useRef(f); // ฟิลเตอร์ที่กดค้นหาแล้ว ใช้ตอนเปลี่ยนหน้า

  const load = useCallback(async (p: number, filters?: typeof f) => {
    if (filters) applied.current = filters;
    const qs = new URLSearchParams({ ...applied.current, page: String(p) });
    const r = await fetch(`/api/admin/audit?${qs}`, { cache: 'no-store' });
    if (!r.ok) return setErr('โหลดประวัติไม่สำเร็จ');
    setErr(''); setData(await r.json());
  }, []);
  useEffect(() => { load(1); }, [load]);

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const set = (k: string, v: string) => setF((o) => ({ ...o, [k]: v }));
  const fmt = (iso: string) => new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  const actionLabel = (action: string) => ({ self_edit: 'ผู้ใช้แก้ไขข้อมูล', self_confirm: 'ผู้ใช้ยืนยันข้อมูล', admin_update: 'ผู้ดูแลแก้ไขข้อมูล' }[action] || action || '-');

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">ประวัติการแก้ไขข้อมูล</h1>
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(1, f); }} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <input className="input" placeholder="บุคคล (อีเมลที่ถูกแก้)" value={f.target} onChange={(e) => set('target', e.target.value)} />
        <input className="input" placeholder="ผู้แก้ (อีเมล)" value={f.editor} onChange={(e) => set('editor', e.target.value)} />
        <select className="input" value={f.field} onChange={(e) => set('field', e.target.value)}><option value="">ทุกฟิลด์</option>{FIELDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <input className="input" type="date" value={f.from} onChange={(e) => set('from', e.target.value)} aria-label="ตั้งแต่วันที่" />
        <input className="input" type="date" value={f.to} onChange={(e) => set('to', e.target.value)} aria-label="ถึงวันที่" />
        <button className="btn">ค้นหา</button>
      </form>
      {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-gray-50 text-gray-600"><tr>{['เวลา', 'ผู้แก้', 'ข้อมูลของ', 'ฟิลด์', 'ค่าเดิม → ค่าใหม่', 'การกระทำ', 'หมายเหตุ'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={i} className="border-t align-top">
                <td className="whitespace-nowrap px-3 py-2">{fmt(r.timestamp)}</td>
                <td className="px-3 py-2"><span className="font-medium">{r.editorName || r.editorEmail}</span><br /><span className="text-xs text-gray-500">{r.editorRole}</span></td>
                <td className="px-3 py-2">{r.targetEmail}</td>
                <td className="px-3 py-2">{FIELDS.find(([k]) => k === r.field)?.[1] ?? r.field}</td>
                <td className="px-3 py-2"><span className="text-gray-500">{r.oldValue || '(ว่าง)'}</span> → <b>{r.newValue || '(ว่าง)'}</b></td>
                <td className="px-3 py-2">{actionLabel(r.action)}</td><td className="px-3 py-2">{r.note || '-'}</td>
              </tr>
            ))}
            {!data.rows.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">ไม่พบประวัติ</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span>ทั้งหมด {data.total} รายการ · หน้า {page}/{pages}</span>
        <div className="space-x-2">
          <button disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1); }} className="rounded border px-3 py-1 disabled:opacity-40">ก่อนหน้า</button>
          <button disabled={page >= pages} onClick={() => { setPage(page + 1); load(page + 1); }} className="rounded border px-3 py-1 disabled:opacity-40">ถัดไป</button>
        </div>
      </div>
    </div>
  );
}
