'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';

type U = {
  id: string; email: string; fullName: string; nickname?: string; birthDate: string; phone: string;
  citizenId: string; institution: string; level: string; major?: string; address?: string;
  collegeProvince?: string; collegeRegion?: string; branchId?: string; branch?: string;
  am?: string; rm?: string; groupShop?: string; sector?: string; province?: string;
  trainingDate?: string; startDate: string; endDate: string; role: string; status: string;
  profileImageUrl?: string; rulesConsentAt?: string; rulesFuturePlan?: string; rulesReason?: string;
};
type Summary = { total: number; verified: number; byStatus: Record<string, number>; byRole: Record<string, { total: number; verified: number }> };
const STATUS = ['รอตรวจสอบ', 'ยืนยันแล้ว', 'ปฏิเสธ'];
const OVERVIEW_FILTER_STATUS = ['รอยืนยัน', 'รับทราบแล้ว', 'ยังไม่รับทราบ', 'ปฏิเสธ', 'ยังไม่ทราบ'];
const ROLES = ['Intern', 'DVE', 'Teacher', 'Admin'];
const KPI_ROLES = ['Intern', 'DVE', 'Teacher'];
const SURVEY_ROLES = ['DVE', 'Intern'];
const PLAN_INTERESTED = 'สนใจทำงานต่อเนื่อง';
const PLAN_INTERESTED_STUDY = 'สนใจทำงานต่อและต้องการศึกษาต่อ (หากบริษัทมีโครงการเรียนต่อไปด้วยทำงานไปด้วยร่วมกับบริษัท)';
const PLAN_INTERESTED_STUDY_SHORT = 'สนใจทำงานต่อและศึกษาต่อ';
const PLAN_NOT_INTERESTED = 'ไม่สนใจ';
const STATUS_STYLES: Record<string, string> = { 'รอตรวจสอบ': 'border-amber-200 bg-amber-50 text-amber-900', 'ยืนยันแล้ว': 'border-emerald-200 bg-emerald-50 text-emerald-900', 'ปฏิเสธ': 'border-rose-200 bg-rose-50 text-rose-900' };
const columns: Array<[string, keyof U | 'index']> = [
  ['ลำดับ', 'index'], ['รหัสบัตรประชาชน', 'citizenId'], ['ชื่อ-นามสกุล', 'fullName'], ['เบอร์โทรติดต่อ', 'phone'],
  ['สถานศึกษา', 'institution'], ['ระดับชั้น', 'level'], ['วันที่เริ่มงาน', 'startDate'], ['วันที่สิ้นสุด', 'endDate'], ['บทบาท', 'role'], ['สถานะ', 'status'], ['เหตุผล', 'rulesReason'],
];
function formatPhone(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '-';
  const normalized = digits.length === 9 ? '0' + digits : digits;
  return normalized.length === 10 ? normalized.slice(0, 3) + '-' + normalized.slice(3, 6) + '-' + normalized.slice(6) : value;
}
function display(u: U, key: keyof U | 'index', index: number) {
  if (key === 'index') return String(index + 1);
  if (key === 'phone') return formatPhone(String(u.phone || ''));
  if (key === 'level') return u.level || (u.role === 'DVE' ? 'ปวส.' : '-');
  if (key === 'rulesReason') return u.rulesReason || '-';
  return String(u[key] || '-');
}
function statusLabel(status: string) {
  return status === 'รอตรวจสอบ' ? 'รอยืนยัน' : status || '-';
}
function workflowStatus(u: U) {
  if (u.role !== 'Admin' && u.status === 'ยืนยันแล้ว') return u.rulesConsentAt ? 'รับทราบแล้ว' : 'ยังไม่รับทราบ';
  return u.status ? statusLabel(u.status) : 'ยังไม่ทราบ';
}
function workflowBadge(u: U) {
  if (u.role !== 'Admin' && u.status === 'ยืนยันแล้ว') return u.rulesConsentAt ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800';
  if (!u.status) return 'bg-amber-100 text-amber-800';
  return u.status === 'ปฏิเสธ' ? 'border-rose-200 bg-rose-50 text-rose-800' : u.status === 'ยืนยันแล้ว' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800';
}
function planMatchesFilter(plan: string | undefined, filter: string) {
  if (!filter) return true;
  if (filter === 'ยังไม่ตอบ') return !plan;
  if (filter === PLAN_INTERESTED_STUDY_SHORT) return plan === PLAN_INTERESTED_STUDY || plan === PLAN_INTERESTED_STUDY_SHORT;
  return plan === filter;
}
function shortPlanLabel(plan: string | undefined) {
  return planMatchesFilter(plan, PLAN_INTERESTED_STUDY_SHORT) ? PLAN_INTERESTED_STUDY_SHORT : plan || 'ยังไม่ตอบ';
}
function exportCsv(rows: U[], rulesConsent: boolean) {
  const headers = rulesConsent
    ? ['ลำดับ', 'ชื่อ-นามสกุล', 'เบอร์โทรติดต่อ', 'สถานศึกษา', 'ระดับชั้น', 'วันที่เริ่มงาน', 'วันที่สิ้นสุด', 'บทบาท', 'คำตอบแผนหลังจบการฝึกงาน', 'เหตุผล']
    : ['อีเมล', 'ชื่อ-นามสกุล', 'เบอร์โทรศัพท์', 'สถานศึกษา', 'ระดับชั้น', 'วันที่เริ่มงาน', 'วันที่สิ้นสุด', 'บทบาท', 'สถานะ', 'แผนหลังจบการฝึกงาน'];
  const phoneAsText = (value: unknown) => {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) return '';
    const phone = digits.length === 9 ? `0${digits}` : digits;
    return `="${phone}"`;
  };
  const values = rows.map((u, index) => rulesConsent
    ? [index + 1, u.fullName, phoneAsText(u.phone), u.institution, u.level || (u.role === 'DVE' ? 'ปวส.' : '-'), u.startDate, u.endDate, u.role, shortPlanLabel(u.rulesFuturePlan), u.rulesFuturePlan === 'ไม่สนใจ' ? (u.rulesReason || '-') : '-']
    : [u.email, u.fullName, phoneAsText(u.phone), u.institution, u.level, u.startDate, u.endDate, u.role, workflowStatus(u), shortPlanLabel(u.rulesFuturePlan) === 'ยังไม่ตอบ' && !u.rulesFuturePlan ? '' : shortPlanLabel(u.rulesFuturePlan)]);
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = '\uFEFF' + [headers, ...values].map((row) => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `รายงานผู้ใช้งาน-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function AdminOverview({ rulesConsent = false, preview = false }: { rulesConsent?: boolean; preview?: boolean }) {
  const [users, setUsers] = useState<U[]>([]);
  const [sum, setSum] = useState<Summary | null>(null);
  const [inst, setInst] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [futurePlan, setFuturePlan] = useState('');
  const [err, setErr] = useState('');
  const [profile, setProfile] = useState<U | null>(null);
  const load = useCallback(async () => {
    if (preview) { setUsers([]); setSum(null); setErr(''); return; }
    const r = await fetch('/api/admin/users', { cache: 'no-store' });
    if (!r.ok) return setErr('โหลดข้อมูลไม่สำเร็จ');
    const d = await r.json(); setUsers(d.users); setSum(d.summary); setErr('');
  }, [preview]);
  useEffect(() => { load(); }, [load]);
  const institutions = useMemo(() => Array.from(new Set(users.map((u) => u.institution?.trim()).filter((name): name is string => !!name && !name.includes('มหาวิทยาลัยตัวอย่าง') && !name.includes('บริษัท')))).sort((a, b) => a.localeCompare(b, 'th')), [users]);
  const shownColumns = rulesConsent
    ? columns.filter(([, key]) => key !== 'citizenId' && key !== 'status' && key !== 'rulesReason').filter(([, key]) => key !== 'rulesFuturePlan')
    : columns.filter(([, key]) => key !== 'rulesReason');
  const rows = (preview && rulesConsent ? [{
    id: 'sample-not-interested', email: 'ตัวอย่าง', fullName: 'ตัวอย่าง ผู้เรียน', nickname: '', birthDate: '', phone: '0812345678', citizenId: '', institution: 'วิทยาลัยตัวอย่าง', level: 'ปวส.', startDate: '-', endDate: '-', role: 'DVE', status: 'ยืนยันแล้ว', rulesFuturePlan: 'ไม่สนใจ', rulesReason: 'ต้องการศึกษาต่อและสมัครงานในสาขาที่สนใจ',
  } as U] : users).filter((u) => (!rulesConsent || SURVEY_ROLES.includes(u.role)) && (!inst || u.institution.toLocaleLowerCase().includes(inst.trim().toLocaleLowerCase())) && (!status || workflowStatus(u) === status) && (!role || u.role === role) && (!rulesConsent || planMatchesFilter(u.rulesFuturePlan, futurePlan)) && (!q || (u.fullName + ' ' + (rulesConsent ? '' : u.citizenId)).toLowerCase().includes(q.toLowerCase())));
  const surveyPopulation = users.filter((u) => SURVEY_ROLES.includes(u.role));
  const surveyStats = {
    dveResponded: surveyPopulation.filter((u) => u.role === 'DVE' && Boolean(u.rulesConsentAt)).length,
    internResponded: surveyPopulation.filter((u) => u.role === 'Intern' && Boolean(u.rulesConsentAt)).length,
    interested: surveyPopulation.filter((u) => u.rulesFuturePlan === PLAN_INTERESTED).length,
    interestedStudy: surveyPopulation.filter((u) => u.rulesFuturePlan === PLAN_INTERESTED_STUDY).length,
    notInterested: surveyPopulation.filter((u) => u.rulesFuturePlan === PLAN_NOT_INTERESTED).length,
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">{!rulesConsent && <h1 className="text-xl font-bold">ภาพรวม</h1>}<button type="button" onClick={() => exportCsv(rows, rulesConsent)} disabled={!rows.length} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">Export ข้อมูล ({rows.length})</button></div>
    {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
    {sum && !rulesConsent && <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{STATUS.map((s) => <Card key={s} title={s} value={(sum.byStatus[s] || 0) + ' คน'} tone={s} />)}{KPI_ROLES.map((r) => <Card key={r} title={r + ' (ยืนยันแล้ว/ทั้งหมด)'} value={(sum.byRole[r]?.verified || 0) + ' / ' + (sum.byRole[r]?.total || 0)} />)}</div>}
    {sum && rulesConsent && <div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><RespondedCard dve={surveyStats.dveResponded} intern={surveyStats.internResponded} /><SurveyCard title="สนใจ" value={String(surveyStats.interested)} tone="green" /><SurveyCard title="สนใจแต่ศึกษาต่อ" value={String(surveyStats.interestedStudy)} tone="violet" /><SurveyCard title="ไม่สนใจ" value={String(surveyStats.notInterested)} tone="rose" /></div>}
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><div><input className="input" aria-label="ค้นหาสถานศึกษา" list="admin-institution-options" value={inst} onChange={(e) => setInst(e.target.value)} placeholder="ทุกสถานศึกษา · พิมพ์เพื่อค้นหา" /><datalist id="admin-institution-options">{institutions.map((i) => <option key={i} value={i} />)}</datalist></div><select className="input" value={role} onChange={(e) => setRole(e.target.value)}><option value="">ทุกบทบาท</option>{(rulesConsent ? SURVEY_ROLES : ROLES).map((r) => <option key={r}>{r}</option>)}</select>{!rulesConsent && <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">ทุกสถานะ</option>{OVERVIEW_FILTER_STATUS.map((s) => <option key={s}>{s}</option>)}</select>}{rulesConsent && <select className="input" value={futurePlan} onChange={(e) => setFuturePlan(e.target.value)}><option value="">ทุกคำตอบ</option><option value={PLAN_INTERESTED}>{PLAN_INTERESTED}</option><option value={PLAN_INTERESTED_STUDY_SHORT}>{PLAN_INTERESTED_STUDY_SHORT}</option><option value={PLAN_NOT_INTERESTED}>{PLAN_NOT_INTERESTED}</option><option value="ยังไม่ตอบ">ยังไม่ตอบ</option></select>}<input className="input" placeholder={rulesConsent ? 'ค้นหาชื่อ' : 'ค้นหาชื่อหรือเลขบัตร'} value={q} onChange={(e) => setQ(e.target.value)} /></div>
    <div className="space-y-3 md:hidden">{rows.map((u, i) => <article key={u.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 font-bold text-emerald-700">{u.profileImageUrl ? <img src={u.profileImageUrl} alt="รูปโปรไฟล์" className="h-full w-full object-cover" /> : u.fullName?.slice(0, 1) || '?'}</div><div className="min-w-0"><h2 className="truncate font-semibold text-slate-900">{display(u, 'fullName', i)}</h2>{!rulesConsent && <p className="truncate text-xs text-slate-500">{display(u, 'citizenId', i)}</p>}</div></div><button onClick={() => setProfile(u)} className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">ดูโปรไฟล์</button></div><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-sm"><MobileField label="เบอร์โทรติดต่อ" value={display(u, 'phone', i)} /><MobileField label="ระดับชั้น" value={display(u, 'level', i)} /><MobileField label="สถานศึกษา" value={display(u, 'institution', i)} full /><MobileField label="วันที่เริ่มงาน" value={display(u, 'startDate', i)} /><MobileField label="วันที่สิ้นสุด" value={display(u, 'endDate', i)} /><MobileField label="บทบาท" value={display(u, 'role', i)} />{rulesConsent ? <><div className="col-span-2"><p className="text-xs text-slate-500">คำตอบแผนหลังจบการฝึกงาน</p><div className="mt-1"><PlanBadge plan={u.rulesFuturePlan} /></div></div><MobileField label="เหตุผลที่ระบุ" value={u.rulesFuturePlan === PLAN_NOT_INTERESTED ? (u.rulesReason || '-') : '-'} full /></> : <><MobileField label="แผนหลังจบการฝึกงาน" value={display(u, 'rulesFuturePlan', i)} full /><MobileField label="เหตุผล" value={display(u, 'rulesReason', i)} full /><div><p className="text-xs text-slate-500">สถานะ</p><span className={'mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs ' + workflowBadge(u)}>{workflowStatus(u)}</span></div></>}</div></article>)}{!rows.length && <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-500">ไม่พบข้อมูล</p>}</div>
    <div className="hidden max-h-[calc(100dvh-15rem)] overflow-auto rounded-xl border bg-white md:block"><table className="w-full min-w-max whitespace-nowrap text-left text-xs lg:text-sm"><thead className="sticky top-0 z-20 bg-gray-50 text-gray-600"><tr><th className="sticky left-0 top-0 z-30 w-14 bg-gray-50 px-1 py-2 text-center lg:w-16 lg:px-1.5">โปรไฟล์</th>{shownColumns.map(([h]) => <th key={h} className="px-2 py-2 lg:px-3" title={h}>{h}</th>)}{rulesConsent && <><th className="px-2 py-2 lg:px-3">คำตอบแผนหลังจบการฝึกงาน</th><th className="px-2 py-2 lg:px-3">เหตุผล</th></>}</tr></thead><tbody>{rows.map((u, i) => <tr key={u.id} className="border-t"><td className="sticky left-0 z-10 w-14 bg-white px-1 py-2 text-center lg:w-16 lg:px-1.5"><button onClick={() => setProfile(u)} aria-label={`ดูโปรไฟล์ ${u.fullName || ''}`} title="ดูโปรไฟล์" className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg></button></td>{shownColumns.map(([, key]) => <td key={String(key)} className="px-2 py-2 align-top lg:px-3" title={display(u, key, i)}>{key === 'status' ? <StatusBadge status={workflowStatus(u)} /> : display(u, key, i)}</td>)}{rulesConsent && <><td className="px-2 py-2 align-top lg:px-3"><PlanBadge plan={u.rulesFuturePlan} /></td><td className="px-2 py-2 align-top lg:px-3">{u.rulesFuturePlan === PLAN_NOT_INTERESTED ? (u.rulesReason || '-') : '-'}</td></>}</tr>)}{!rows.length && <tr><td colSpan={shownColumns.length + (rulesConsent ? 3 : 1)} className="px-3 py-6 text-center text-gray-500">ไม่พบข้อมูล</td></tr>}</tbody></table></div>
    <p className="text-xs text-gray-500">เลื่อนตารางด้านข้างเพื่อดูข้อมูลครบทุกคอลัมน์ · คลิกดูโปรไฟล์เพื่อดู Email และรายละเอียดเพิ่มเติม</p>
    {profile && <ProfileModal user={profile} onClose={() => setProfile(null)} />}
  </div>;
}
const MobileField = ({ label, value, full = false }: { label: string; value: string; full?: boolean }) => <div className={full ? 'col-span-2' : ''}><p className="text-xs text-slate-500">{label}</p><p className="mt-0.5 truncate font-medium text-slate-800">{value}</p></div>;
const toneStyles: Record<string, string> = { amber: 'border-amber-200 bg-amber-50 text-amber-950', emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950', rose: 'border-rose-200 bg-rose-50 text-rose-950', blue: 'border-sky-200 bg-sky-50 text-sky-950', green: 'border-emerald-200 bg-emerald-50 text-emerald-950', violet: 'border-violet-200 bg-violet-50 text-violet-950' };
const Card = ({ title, value, tone }: { title: string; value: string; tone?: string }) => <div className={'rounded-xl border p-4 ' + (tone ? STATUS_STYLES[tone] : 'border-slate-200 bg-white')}><p className="text-xs opacity-75">{title}</p><p className="mt-1 text-lg font-bold">{value}</p></div>;
const SurveyCard = ({ title, value, tone }: { title: string; value: string; tone: string }) => <div className={'rounded-xl border p-4 ' + toneStyles[tone]}><p className="text-xs font-medium opacity-75">{title}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-0.5 text-xs opacity-70">คน</p></div>;
const RespondedCard = ({ dve, intern }: { dve: number; intern: number }) => <div className={'rounded-xl border p-4 ' + toneStyles.blue}><p className="text-xs font-medium opacity-75">ประเมินแล้ว</p><div className="mt-2 flex items-baseline justify-between gap-3"><span className="text-sm font-medium">DVE</span><span className="text-2xl font-bold">{dve} <small className="text-xs font-normal">คน</small></span></div><div className="mt-1 flex items-baseline justify-between gap-3"><span className="text-sm font-medium">Intern</span><span className="text-2xl font-bold">{intern} <small className="text-xs font-normal">คน</small></span></div></div>;
function StatusBadge({ status }: { status: string }) { const tone = status === 'รับทราบแล้ว' || status === 'ยืนยันแล้ว' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : status === 'ปฏิเสธ' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'; return <span className={'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ' + tone}>{status}</span>; }
function PlanBadge({ plan }: { plan?: string }) { const tone = plan === PLAN_INTERESTED ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : planMatchesFilter(plan, PLAN_INTERESTED_STUDY_SHORT) ? 'border-violet-200 bg-violet-50 text-violet-800' : plan === PLAN_NOT_INTERESTED ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'; const label = shortPlanLabel(plan); return <span className={'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ' + tone} title={plan || 'ยังไม่ตอบ'}>{label}</span>; }
function ProfileModal({ user, onClose }: { user: U; onClose: () => void }) {
  const [imageOpen, setImageOpen] = useState(false);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Student profile</p><h2 className="mt-1 text-xl font-bold text-slate-900">{user.fullName || 'ไม่ระบุชื่อ'}</h2><p className="text-sm text-slate-500">Email: {user.email || '-'}</p></div><div className="flex items-center gap-3"><button onClick={() => user.profileImageUrl && setImageOpen(true)} className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-xl font-bold text-emerald-700 ring-2 ring-emerald-200">{user.profileImageUrl ? <img src={user.profileImageUrl} alt="รูปโปรไฟล์นักศึกษา" className="h-full w-full object-cover" /> : user.fullName?.slice(0, 1) || '?'}</button><button onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-slate-400">×</button></div></div><dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">{columns.filter(([, key]) => key !== 'index').map(([label, key]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-0.5 font-medium text-slate-800">{display(user, key, 0)}</dd></div>)}</dl><button onClick={onClose} className="btn mt-6 w-full">ปิด</button></div>{imageOpen && user.profileImageUrl && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setImageOpen(false)}><img src={user.profileImageUrl} alt="รูปโปรไฟล์ต้นฉบับ" className="max-h-[90vh] max-w-full rounded-xl object-contain" /></div>}</div>;
}
