import { NextResponse } from 'next/server';
import { requireSession, saveUser } from '@/lib/auth';
import { findUserByEmail, normaliseDveRow } from '@/lib/users';
import { writeAudit, type AuditEntry } from '@/lib/audit';
import { cleanPhone, isThaiPhone, isValidPastDate, maskBirth, maskPhone, normName, normalizeDateInput } from '@/lib/validators';
import { sameOrigin } from '@/lib/security';
import { appendRow, updateDveNickname } from '@/lib/sheets';

export async function GET() {
  const me = await requireSession(['Intern', 'DVE', 'Teacher']);
  if (!me) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  const raw = await findUserByEmail(me.email);
  if (!raw) return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้' }, { status: 404 });
  const u = normaliseDveRow(raw);
  return NextResponse.json({
    email: u.email, citizenId: u.citizenId, fullName: u.fullName, nickname: u.nickname || '', institution: u.institution, level: u.level || (u.role === 'DVE' ? 'ปวส.' : ''), startDate: u.startDate, endDate: u.endDate, role: u.role, status: u.status, rulesConsentAt: u.rulesConsentAt || '', rulesFuturePlan: u.rulesFuturePlan || '', rulesReason: u.rulesReason || '', profileImageUrl: u.profileImageUrl || '',
    phone: u.phone, birthDate: u.birthDate, phoneMasked: maskPhone(u.phone), birthMasked: maskBirth(u.birthDate), consented: !!u.consentAt,
  });
}

export async function PATCH(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 403 });
  const me = await requireSession(['Intern', 'DVE', 'Teacher']);
  if (!me) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const source = await findUserByEmail(me.email); // แก้ได้เฉพาะแถวของตัวเอง
  const u = source ? normaliseDveRow(source) : null;
  if (!u) return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้' }, { status: 404 });
  if (b.rulesConsent === true) {
    if (u.status !== 'ยืนยันแล้ว') return NextResponse.json({ error: 'ต้องยืนยันตัวตนก่อนรับทราบกฎระเบียบ' }, { status: 409 });
    const rulesFuturePlan = String(b.rulesFuturePlan || '').trim();
    const rulesReason = String(b.rulesReason || '').trim();
    if (['DVE', 'Intern'].includes(u.role) && !rulesFuturePlan) return NextResponse.json({ error: 'กรุณาเลือกความประสงค์หลังสำเร็จการฝึกงาน' }, { status: 400 });
    if (['DVE', 'Intern'].includes(u.role) && rulesFuturePlan === 'ไม่สนใจ' && !rulesReason) return NextResponse.json({ error: 'กรุณากรอกเหตุผล' }, { status: 400 });
    const rulesConsentAt = !u.rulesConsentAt || u.rulesFuturePlan !== rulesFuturePlan || u.rulesReason !== rulesReason
      ? new Date().toISOString()
      : u.rulesConsentAt;
    if (rulesConsentAt !== u.rulesConsentAt) {
      await saveUser({ ...u, rulesConsentAt, rulesFuturePlan, rulesReason } as unknown as typeof u);
    }
    return NextResponse.json({ ok: true, rulesConsentAt });
  }
  if (u.status !== 'รอตรวจสอบ') return NextResponse.json({ error: 'ข้อมูลถูกยืนยันแล้ว ไม่สามารถแก้ไขเองได้' }, { status: 409 });
  const changes: AuditEntry[] = [];
  const base = { editorEmail: me.email, editorRole: me.role, targetEmail: u.email, action: 'self_edit' };
  const next = { ...u };

  if (b.fullName !== undefined && b.fullName !== '') {
    const v = normName(b.fullName);
    if (v.length < 3 || v.length > 100) return NextResponse.json({ error: 'ชื่อ-นามสกุลไม่ถูกต้อง' }, { status: 400 });
    if (v !== u.fullName) { changes.push({ ...base, field: 'fullName', oldValue: u.fullName, newValue: v }); next.fullName = v; }
  }
  if (u.role !== 'Teacher' && b.nickname !== undefined) {
    const v = String(b.nickname).trim().slice(0, 80);
    if (v !== (u.nickname || '')) { changes.push({ ...base, field: 'nickname', oldValue: u.nickname || '', newValue: v }); next.nickname = v; }
  }
  if (b.institution !== undefined && String(b.institution).trim() !== '') {
    const v = String(b.institution).trim();
    if (v.length > 200) return NextResponse.json({ error: 'ชื่อสถานศึกษาไม่ถูกต้อง' }, { status: 400 });
    if (v !== u.institution) { changes.push({ ...base, field: 'institution', oldValue: u.institution, newValue: v }); next.institution = v; }
  }
  if (b.phone) {
    if (!isThaiPhone(String(b.phone))) return NextResponse.json({ error: 'เบอร์โทรศัพท์ไม่ถูกต้อง (เช่น 0812345678)' }, { status: 400 });
    const v = cleanPhone(String(b.phone));
    if (v !== u.phone) { changes.push({ ...base, field: 'phone', oldValue: u.phone, newValue: v }); next.phone = v; }
  }
  if (b.birthDate) {
    const raw = String(b.birthDate).trim();
    if (!normalizeDateInput(raw) || !isValidPastDate(raw)) return NextResponse.json({ error: 'วันเกิดไม่ถูกต้องหรืออยู่ในอนาคต (รองรับ ค.ศ. และ พ.ศ. เช่น 16-12-2547)' }, { status: 400 });
    const v = raw;
    if (v !== u.birthDate) { changes.push({ ...base, field: 'birthDate', oldValue: u.birthDate, newValue: v }); next.birthDate = v; }
  }
  if (b.confirm) {
    if (b.consent !== true && !u.consentAt) return NextResponse.json({ error: 'กรุณายินยอมการเก็บและใช้ข้อมูลส่วนบุคคลก่อน' }, { status: 400 });
    if (!next.phone || (u.role !== 'Teacher' && !next.birthDate)) return NextResponse.json({ error: u.role === 'Teacher' ? 'กรุณากรอกเบอร์โทรให้ครบ' : 'กรุณากรอกเบอร์โทรและวันเกิดให้ครบ' }, { status: 400 });
    const now = new Date().toISOString();
    next.consentAt = u.consentAt || now;
    next.status = 'ยืนยันแล้ว';
    next.verifiedAt = now;
    changes.push({ ...base, field: 'status', oldValue: u.status, newValue: 'ยืนยันแล้ว', action: 'self_confirm', note: 'ยินยอม PDPA' });
  }

  if (changes.length) {
    if (source?._tab === 'DVE' && b.confirm) {
      // DVE เป็นข้อมูลต้นฉบับจาก Excel: ห้ามเขียนทับแถวเดิม เพราะคอลัมน์ Excel
      // ไม่ใช่โครงสร้างเดียวกับ UserRow ภายในระบบ ให้สร้างแถวที่ยืนยันแล้วแยกแทน
      await appendRow('VerifiedUsers', {
        id: next.id || `verified-${Date.now()}`,
        email: next.email || me.email,
        fullName: next.fullName,
        phone: next.phone,
        birthDate: next.birthDate,
        institution: next.institution,
        role: 'DVE',
        status: 'ยืนยันแล้ว',
        verifiedAt: next.verifiedAt,
        createdAt: next.createdAt,
        consentAt: next.consentAt,
        citizenId: next.citizenId,
        username: next.username,
        passwordHash: next.passwordHash,
        level: next.level || 'ปวส.',
        startDate: next.startDate,
        endDate: next.endDate,
        profileImageUrl: next.profileImageUrl,
        profileEmail: next.email || me.email,
        rulesConsentAt: next.rulesConsentAt,
        rulesFuturePlan: next.rulesFuturePlan,
        rulesReason: next.rulesReason,
      });
      if (next.nickname !== undefined && source.phone !== next.nickname) {
        // คอลัมน์ phone ของข้อมูล DVE เดิมคือคอลัมน์ชื่อเล่น จึงอัปเดตเฉพาะช่องนี้
        await updateDveNickname(source, next.nickname);
      }
    } else {
      await saveUser(next);
    }
    await writeAudit(changes);
  }
  return NextResponse.json({ ok: true, status: next.status });
}
