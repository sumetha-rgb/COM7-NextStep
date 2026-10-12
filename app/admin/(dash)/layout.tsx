import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import { findAdminByEmail } from '@/lib/users';

export const dynamic = 'force-dynamic';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireSession(['Admin']);
  if (!me) redirect('/admin/login');
  const admin = await findAdminByEmail(me.email);
  return (
    <div className="min-h-screen md:flex">
      <Sidebar email={me.email} fullName={me.name || admin?.fullName || 'ผู้ดูแลระบบ'} username={admin?.username || ''} />
      <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
