import { NextResponse } from 'next/server';
import { requireSession, saveUser } from '@/lib/auth';
import { findUserByEmail, findVerifiedByCitizenId, invalidateLookupCache, normaliseDveRow } from '@/lib/users';
import { writeAudit, type AuditEntry } from '@/lib/audit';
import { cleanPhone, isThaiPhone, isValidPastDate, maskBirth, maskPhone, normName, normalizeDateInput } from '@/lib/validators';
import { sameOrigin } from '@/lib/security';
import { appendRow, updateDveNickname, updateInternRosterFields } from '@/lib/sheets';
import { getManagedRules, saveRuleAcknowledgement } from '@/lib/managed-rules';
import { normalizeFuturePlanValue } from '@/content/rules';

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
  if (!source) return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้' }, { status: 404 });
  const u = normaliseDveRow(source);
  // Profile details remain editable after identity confirmation. Restrict this
  // path to the three self-service fields shown in the profile dialog.
  if (b.profileEdit === true) {
    const changes: AuditEntry[] = [];
    const base = { editorEmail: me.email, editorRole: me.role, targetEmail: u.email, action: 'self_edit' };
    const next = { ...u };
    if (b.fullName !== undefined) {
      const value = normName(b.fullName);
      if (value.length < 3 || value.length > 100) return NextResponse.json({ error: 'ชื่อ-นามสกุลไม่ถูกต้อง' }, { status: 400 });
      if (value !== u.fullName) { changes.push({ ...base, field: 'fullName', oldValue: u.fullName, newValue: value }); next.fullName = value; }
    }
    if (u.role !== 'Teacher' && b.nickname !== undefined) {
      const value = String(b.nickname).normalize('NFC').trim();
      if (value.length > 80) return NextResponse.json({ error: 'ชื่อเล่นต้องไม่เกิน 80 ตัวอักษร' }, { status: 400 });
      if (value !== (u.nickname || '')) { changes.push({ ...base, field: 'nickname', oldValue: u.nickname || '', newValue: value }); next.nickname = value; }
    }
    if (b.phone !== undefined) {
      if (!isThaiPhone(String(b.phone))) return NextResponse.json({ error: 'เบอร์โทรศัพท์ไม่ถูกต้อง (เช่น 0812345678)' }, { status: 400 });
      const value = cleanPhone(String(b.phone));
      if (value !== u.phone) { changes.push({ ...base, field: 'phone', oldValue: u.phone, newValue: value }); next.phone = value; }
    }
    if (changes.length) {
      if (['DVE', 'INTERN'].includes(String(source._tab)) && source._layout !== 'legacy') {
        const verified = await findVerifiedByCitizenId(next.citizenId);
        if (verified) {
          await saveUser({ ...verified, fullName: next.fullName, nickname: next.nickname, phone: next.phone } as unknown as typeof source);
          // The source roster remains the fallback account record on a later login.
          if (source._tab === 'DVE' && next.nickname !== undefined) await updateDveNickname(source, next.nickname);
          if (source._tab === 'INTERN' && source._layout === 'roster') {
            await updateInternRosterFields(source, { fullName: next.fullName, nickname: next.nickname, phone: next.phone });
          }
        }
        else await saveUser(next);
        if (next.role === 'DVE' && next.nickname !== undefined) await updateDveNickname(source, next.nickname);
        if (source._tab === 'INTERN' && source._layout === 'roster') {
          await updateInternRosterFields(source, { fullName: next.fullName, nickname: next.nickname, phone: next.phone });
        }
      } else {
        await saveUser(next);
      }
      await writeAudit(changes);
      invalidateLookupCache();
    }
    return NextResponse.json({ ok: true, fullName: next.fullName, nickname: next.nickname || '', phone: next.phone });
  }
  if (b.rulesConsent === true) {
    if (!['ยืนยันแล้ว', 'ยืนยันแล้วแก้ไข'].includes(u.status)) return NextResponse.json({ error: 'ต้องยืนยันตัวตนก่อนรับทราบกฎระเบียบ' }, { status: 409 });
    const currentRules = (await getManagedRules())[u.role as 'Intern' | 'DVE' | 'Teacher'];
    if (!currentRules.enabled) return NextResponse.json({ error: 'กฎระเบียบยังไม่เปิดให้รับทราบ กรุณาติดต่อผู้ดูแลระบบ' }, { status: 409 });
    if (Number(b.rulesVersion) !== (currentRules.version || 1)) return NextResponse.json({ error: 'กฎระเบียบมีการเปลี่ยนแปลง กรุณาโหลดหน้าใหม่และอ่านอีกครั้ง' }, { status: 409 });
    const rulesFuturePlan = normalizeFuturePlanValue(String(b.rulesFuturePlan || '').trim());
    const rulesReason = String(b.rulesReason || '').trim();
    if (['DVE', 'Intern'].includes(u.role) && !rulesFuturePlan) return NextResponse.json({ error: 'กรุณาเลือกความประสงค์หลังสำเร็จการฝึกงาน' }, { status: 400 });
    if (['DVE', 'Intern'].includes(u.role) && currentRules.futurePlanRequired && !currentRules.futurePlanOptions?.some((option) => normalizeFuturePlanValue(option.value) === rulesFuturePlan)) return NextResponse.json({ error: 'คำตอบแผนหลังฝึกงานไม่ถูกต้อง' }, { status: 400 });
    if (['DVE', 'Intern'].includes(u.role) && rulesFuturePlan === 'ไม่สนใจทำงานต่อ' && !rulesReason) return NextResponse.json({ error: 'กรุณากรอกเหตุผล' }, { status: 400 });
    const rulesConsentAt = !u.rulesConsentAt || u.rulesFuturePlan !== rulesFuturePlan || u.rulesReason !== rulesReason
      ? new Date().toISOString()
      : u.rulesConsentAt;
    if (rulesConsentAt !== u.rulesConsentAt) {
      await saveUser({ ...u, rulesConsentAt, rulesFuturePlan, rulesReason } as unknown as typeof u);
    }
    await saveRuleAcknowledgement(me.email, u.role as 'Intern' | 'DVE' | 'Teacher', currentRules.version || 1);
    return NextResponse.json({ ok: true, rulesConsentAt });
  }
  if (b.confirm && b.consent !== true) {
    return NextResponse.json({ error: 'กรุณาอ่านและยินยอมการเก็บ ใช้ และประมวลผลข้อมูลก่อนบันทึก' }, { status: 400 });
  }
  // การส่งคำขอยืนยันซ้ำหลังคำขอแรกสำเร็จให้เป็น idempotent ไม่ตอบ 409
  // และไม่เขียนข้อมูลหรือบันทึกประวัติซ้ำ
  if (b.confirm && ['ยืนยันแล้ว', 'ยืนยันแล้วแก้ไข'].includes(u.status)) {
    return NextResponse.json({ ok: true, status: u.status, alreadyConfirmed: true });
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
    if (!next.phone || (u.role !== 'Teacher' && !next.birthDate)) return NextResponse.json({ error: u.role === 'Teacher' ? 'กรุณากรอกเบอร์โทรให้ครบ' : 'กรุณากรอกเบอร์โทรและวันเกิดให้ครบ' }, { status: 400 });
    const now = new Date().toISOString();
    next.consentAt = u.consentAt || now;
    next.status = 'ยืนยันแล้ว';
    next.verifiedAt = now;
    changes.push({ ...base, field: 'status', oldValue: u.status, newValue: 'ยืนยันแล้ว', action: 'self_confirm', note: 'ยินยอม PDPA' });
  }

  if (changes.length) {
    if (source && ['DVE', 'INTERN'].includes(String(source._tab)) && b.confirm && source._layout !== 'legacy') {
      // DVE/INTERN เป็นข้อมูลต้นทางจาก Excel: คงแถวต้นฉบับไว้ แล้วบันทึกข้อมูลมาตรฐานลง VerifiedUsers
      const verifiedRow = {
        id: next.id || `verified-${Date.now()}`,
        email: next.email || (me.email.startsWith('citizen:') ? '' : me.email),
        fullName: next.fullName,
        phone: next.phone,
        birthDate: next.birthDate,
        institution: next.institution,
        role: next.role,
        status: 'ยืนยันแล้ว',
        verifiedAt: next.verifiedAt,
        createdAt: next.createdAt,
        consentAt: next.consentAt,
        citizenId: next.citizenId,
        username: next.username,
        passwordHash: next.passwordHash,
        level: next.level || (next.role === 'DVE' ? 'ปวส.' : ''),
        startDate: next.startDate,
        endDate: next.endDate,
        profileImageUrl: next.profileImageUrl,
        profileEmail: next.email || (me.email.startsWith('citizen:') ? '' : me.email),
        rulesConsentAt: next.rulesConsentAt,
        rulesFuturePlan: next.rulesFuturePlan,
        rulesReason: next.rulesReason,
      };
      const alreadyVerified = await findVerifiedByCitizenId(next.citizenId);
      if (alreadyVerified) await saveUser({ ...alreadyVerified, ...verifiedRow } as unknown as typeof source);
      else await appendRow('VerifiedUsers', verifiedRow);
      if (next.role === 'DVE' && next.nickname !== undefined && source.phone !== next.nickname) {
        // คอลัมน์ phone ของข้อมูล DVE เดิมคือคอลัมน์ชื่อเล่น จึงอัปเดตเฉพาะช่องนี้
        await updateDveNickname(source, next.nickname);
      }
      if (next.role === 'Intern' && source._layout === 'roster') {
        await updateInternRosterFields(source, next as unknown as Record<string, unknown>);
      }
    } else if (source && source._tab === 'INTERN' && source._layout === 'roster') {
      await updateInternRosterFields(source, next as unknown as Record<string, unknown>);
    } else {
      await saveUser(next);
    }
    await writeAudit(changes);
    invalidateLookupCache();
  }
  return NextResponse.json({ ok: true, status: next.status });
}
