import AdminOverview from '@/components/AdminOverview';

export const dynamic = 'force-dynamic';

export default function RulesConsentPage() {
  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-xl font-bold">การประเมิน</h1>
      </div>
      <AdminOverview rulesConsent />
    </div>
  );
}
