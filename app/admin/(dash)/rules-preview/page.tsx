import Link from 'next/link';
import RulesView from '@/components/RulesView';
import { RULE_ROLES, type RuleRole } from '@/content/rules';
import { getManagedRules } from '@/lib/managed-rules';

export default async function Page({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const params = await searchParams;
  const role: RuleRole = RULE_ROLES.includes(params.role as RuleRole) ? (params.role as RuleRole) : 'Intern';
  const rules = await getManagedRules();
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {RULE_ROLES.map((r) => (
          <Link key={r} href={`/admin/rules-preview?role=${r}`} className={`rounded-full border px-4 py-1.5 text-sm ${r === role ? 'bg-blue-600 text-white' : 'bg-white'}`}>{r}</Link>
        ))}
      </div>
      <RulesView rules={rules[role]} storageScope="admin-preview" persistProgress={false} />
    </div>
  );
}
