import AppShell from '@/components/AppShell';
import { type NavLink } from '@/components/Nav';
import Footer from '@/components/Footer';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

const links: NavLink[] = [
  { href: '/student', label: 'ใบเทียบของฉัน' },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
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
