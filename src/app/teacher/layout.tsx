import AppShell from '@/components/AppShell';
import { type NavLink } from '@/components/Nav';
import NavYearSelector from '@/components/NavYearSelector';
import Footer from '@/components/Footer';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

const teacherLinks: NavLink[] = [
  { href: '/teacher', label: 'หน้าแรก' },
  {
    label: 'การจัดการ',
    children: [
      { href: '/teacher/years', label: '📅 จัดการปีการศึกษา' },
      { href: '/teacher/faculties', label: '🏛️ จัดการคณะ' },
      { href: '/teacher/programs', label: '🎓 จัดการสาขาวิชา' },
      { href: '/teacher/uni-courses', label: '📚 จัดการรายวิชา' },
    ],
  },
  { href: '/teacher/students', label: 'นักศึกษา' },
  { href: '/teacher/sheets', label: 'ใบเทียบโอน' },
  { href: '/teacher/report', label: 'รายงาน' },
];

const committeeLinks: NavLink[] = [
  { href: '/teacher', label: 'หน้าแรก' },
  { href: '/teacher/students', label: 'นักศึกษา' },
  { href: '/teacher/sheets', label: 'ใบเทียบโอน' },
  { href: '/teacher/report', label: 'รายงาน' },
];

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if ((session.user as any)?.mustChangePassword) redirect('/change-password');
  const role = (session.user as any)?.role;
  const links = role === 'committee' ? committeeLinks : teacherLinks;
  return (
    <div className="min-h-screen flex flex-col">
      <AppShell
        links={links}
        extraRight={<NavYearSelector variant="desktop" />}
      >
        {children}
      </AppShell>
      <Footer />
    </div>
  );
}
