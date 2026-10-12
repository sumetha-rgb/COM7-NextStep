import { NextResponse } from 'next/server';
import { requireSession, saveUser } from '@/lib/auth';
import { findUserByEmail, listUsersCached } from '@/lib/users';
import { writeAudit, type AuditEntry } from '@/lib/audit';
import { isRole, isStatus, ROLES, STATUSES } from '@/lib/permissions';
import { sameOrigin } from '@/lib/security';

export async function GET() {
  const me = await requireSession(['Admin']);
  if (!me) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  const users = await listUsersCached();
  const byStatus: Record<string, number> = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  const byRole: Record<string, { total: number; verified: number }> = Object.fromEntries(ROLES.map((r) => [r, { total: 0, verified: 0 }]));
  for (const u of users) {
    if (u.status in byStatus) byStatus[u.status]++;
    if (u.role in byRole) { byRole[u.role].total++; if (u.status === 'ยืนยันแล้ว') byRole[u.role].verified++; }
  }
  return NextResponse.json({
    users: users.map((u) => ({ id: u.id, email: u.email || u.profileEmail || '', fullName: u.fullName, phone: u.phone, birthDate: u.birthDate, institution: u.institution, role: u.role, status: u.status, rulesConsentAt: u.rulesConsentAt || '', rulesFuturePlan: u.rulesFuturePlan || '', rulesReason: u.rulesReason || '', verifiedAt: u.verifiedAt, citizenId: u.citizenId, level: u.level, startDate: u.startDate, endDate: u.endDate, profileImageUrl: u.profileImageUrl || '', nickname: u.nickname, major: u.major, address: u.address, collegeProvince: u.collegeProvince, collegeRegion: u.collegeRegion, branchId: u.branchId, branch: u.branch, am: u.am, rm: u.rm, groupShop: u.groupShop, sector: u.sector, province: u.province, trainingDate: u.trainingDate })),
    summary: { total: users.length, verified: byStatus['ยืนยันแล้ว'], byStatus, byRole },
  });
}

export async function PATCH(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 403 });
  const me = await requireSession(['Admin']);
  if (!me) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const u = await findUserByEmail(String(b.lookupEmail || b.email || ''));
  if (!u) return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });

  const next = { ...u };
  const changes: AuditEntry[] = [];
  const base = { editorEmail: me.email, editorRole: me.role, targetEmail: u.email, action: 'admin_update', note: String(b.note || '').slice(0, 200) };
  const isSelf = u.email.toLowerCase() === me.email.toLowerCase();

  if (b.status !== undefined) {
    if (!isStatus(b.status)) return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 });
    if (isSelf) return NextResponse.json({ error: 'ไม่สามารถเปลี่ยนสถานะของตัวเองได้' }, { status: 400 });
    if (b.status !== u.status) {
      changes.push({ ...base, field: 'status', oldValue: u.status, newValue: b.status });
      next.status = b.status;
      next.verifiedAt = b.status === 'ยืนยันแล้ว' ? new Date().toISOString() : '';
    }
  }
  if (b.role !== undefined) {
    if (!isRole(b.role)) return NextResponse.json({ error: 'บทบาทไม่ถูกต้อง' }, { status: 400 });
    if (isSelf) return NextResponse.json({ error: 'ไม่สามารถเปลี่ยนบทบาทของตัวเองได้' }, { status: 400 });
    if (b.role !== u.role) { changes.push({ ...base, field: 'role', oldValue: u.role, newValue: b.role }); next.role = b.role; }
  }
  if (changes.length) { await saveUser(next); await writeAudit(changes); }
  return NextResponse.json({ ok: true });
}
