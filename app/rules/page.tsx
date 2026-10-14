import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { findUserByEmail } from '@/lib/users';
import { normalizeFuturePlanValue, type RuleRole } from '@/content/rules';
import { getManagedRules, getRuleAcknowledgement } from '@/lib/managed-rules';
import RulesView from '@/components/RulesView';
import MobileBottomNav from '@/components/MobileBottomNav';
import UserHeader from '@/components/UserHeader';

export const dynamic = 'force-dynamic';

export default async function RulesPage() {
  const me = await requireSession(['Intern', 'DVE', 'Teacher']);
  if (!me) redirect('/login');

  const raw = await findUserByEmail(me.email, true);
  if (!raw || raw.status === 'ปฏิเสธ') redirect('/login');
  if (!['ยืนยันแล้ว', 'ยืนยันแล้วแก้ไข'].includes(raw.status)) redirect('/confirm');
  const name = raw.fullName || me.name || me.email;
  const profileImageUrl = raw.profileImageUrl || '';
  const rules = (await getManagedRules())[me.role as RuleRole];
  const acknowledgement = await getRuleAcknowledgement(me.email, me.role as RuleRole);
  const hasCurrentAcknowledgement = acknowledgement
    ? Number(acknowledgement.version) === (rules.version || 1)
    : (rules.version || 1) === 1 && Boolean(raw.rulesConsentAt);

  // เนื้อหาเลือกจาก role ใน session เท่านั้น (ไม่รับพารามิเตอร์จากผู้ใช้)
  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,#ecfdf5_0%,#f8fafc_30%,#f8fafc_100%)]">
      <UserHeader name={name} profileImageUrl={profileImageUrl} />
      <RulesView rules={rules} serverConsented={Boolean(raw.rulesConsentAt) && hasCurrentAcknowledgement} serverFuturePlan={hasCurrentAcknowledgement ? normalizeFuturePlanValue(raw.rulesFuturePlan || '') : ''} serverFutureReason={raw.rulesReason || ''} />
      <MobileBottomNav />
    </main>
  );
}

/* ใน app/layout.tsx ให้เพิ่ม (จำเป็นสำหรับ safe-area บน iPhone):

import type { Viewport } from 'next';
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#047857',
};
*/
