import AppShell from '@/components/AppShell';
import { type NavLink } from '@/components/Nav';
import Footer from '@/components/Footer';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

const links: NavLink[] = [
  { href: '/admin', label: 'หน้าแรก' },
  { href: '/admin/users', label: 'จัดการผู้ใช้' },
  { href: '/admin/faculties', label: 'คณะ' },
  { href: '/admin/programs', label: 'สาขาวิชา' },
  { href: '/admin/settings', label: 'ตั้งค่าระบบ' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if ((session.user as any)?.mustChangePassword) redirect('/change-password');
  return (
    <div className="min-h-screen flex flex-col">
      <AppShell links={links}>{children}</AppShell>
      <Footer />
    </div>
  );
}
