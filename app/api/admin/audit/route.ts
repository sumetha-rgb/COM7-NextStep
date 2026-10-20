import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { findAdminByEmail, findUserByEmail } from '@/lib/users';
import { readTab } from '@/lib/sheets';

const allAudit = unstable_cache(
  async () => (await readTab('AuditLog')).map(({ _row, ...r }) => r).sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  ['audit-all'], { revalidate: 30, tags: ['audit'] },
);
const bangkokDate = (value: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(value));

// อ่านอย่างเดียว: ไม่มี POST/PATCH/DELETE
export async function GET(req: Request) {
  const me = await requireSession(['Admin']);
  if (!me) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  const p = new URL(req.url).searchParams;
  const q = (p.get('target') || '').trim().toLowerCase();
  const editor = (p.get('editor') || '').trim().toLowerCase();
  const field = p.get('field') || '';
  const from = p.get('from') || '';
  const to = p.get('to') || '';
  const size = 20;
  const page = Math.max(1, Number(p.get('page')) || 1);

  const auditRows = await allAudit();
  const names = new Map<string, string>();
  const resolveName = async (email: string) => {
    const key = email.toLowerCase();
    if (!names.has(key)) {
      const actor = await findUserByEmail(email);
      const admin = actor ? null : await findAdminByEmail(email);
      names.set(key, actor?.fullName || admin?.fullName || email);
    }
    return names.get(key)!;
  };
  const rows = (await Promise.all(auditRows.map(async (r) => ({
    ...r,
    editorName: await resolveName(r.editorEmail),
    targetName: await resolveName(r.targetEmail),
  })))).filter((r) =>
    (!q || r.targetEmail.toLowerCase().includes(q) || r.targetName.toLowerCase().includes(q)) &&
    (!editor || r.editorEmail.toLowerCase().includes(editor) || r.editorName.toLowerCase().includes(editor)) &&
    (!field || r.field === field) &&
    (!from || bangkokDate(r.timestamp) >= from) &&
    (!to || bangkokDate(r.timestamp) <= to));
  const pageRows = rows.slice((page - 1) * size, page * size);
  return NextResponse.json({ total: rows.length, page, pageSize: size, rows: pageRows });
}
