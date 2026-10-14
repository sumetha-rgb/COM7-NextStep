import { NextResponse } from 'next/server';
import { RULE_ROLES, type RuleRole } from '@/content/rules';
import { getManagedRules, saveManagedRule } from '@/lib/managed-rules';
import { readTab } from '@/lib/sheets';
import { requireSession } from '@/lib/auth';
import { sameOrigin } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await requireSession(['Admin']);
  if (!me) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  try {
    const [rules, history] = await Promise.all([getManagedRules(), readTab('RulesHistory')]);
    return NextResponse.json({ rules, history: history.slice(-100).reverse().map(({ timestamp, role, version, editorEmail }) => ({ timestamp, role, version, editorEmail })) });
  }
  catch (error) { console.error('load managed rules failed', error); return NextResponse.json({ error: 'โหลดกฎระเบียบไม่สำเร็จ' }, { status: 500 }); }
}

export async function PUT(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 403 });
  const me = await requireSession(['Admin']);
  if (!me) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const role = body.role as RuleRole;
  if (!RULE_ROLES.includes(role)) return NextResponse.json({ error: 'บทบาทไม่ถูกต้อง' }, { status: 400 });
  try {
    const rule = await saveManagedRule(role, body.rule || {}, me.email);
    return NextResponse.json({ ok: true, rule });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'บันทึกกฎระเบียบไม่สำเร็จ';
    console.error('save managed rules failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
