import AppShell from '@/components/AppShell';
import { type NavLink } from '@/components/Nav';
import NavYearSelector from '@/components/NavYearSelector';
import Footer from '@/components/Footer';
import NoAssignedYearsScreen from '@/components/NoAssignedYearsScreen';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import { User } from '@/models/User';

const teacherLinks: NavLink[] = [
  { href: '/teacher', label: 'หน้าแรก' },
  {
    label: 'การจัดการ',
    children: [
      { href: '/teacher/years', label: '📅 จัดการปีการศึกษา' },
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
  {
    label: 'การจัดการ',
    children: [
      { href: '/teacher/years', label: '📅 จัดการปีการศึกษา' },
      { href: '/teacher/programs', label: '🎓 จัดการสาขาวิชา' },
      { href: '/teacher/uni-courses', label: '📚 จัดการรายวิชา' },
    ],
  },
  { href: '/teacher/students', label: 'นักศึกษา' },
  { href: '/teacher/sheets', label: 'ใบเทียบโอน' },
  { href: '/teacher/report', label: 'รายงาน' },
];

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if ((session.user as any)?.mustChangePassword) redirect('/change-password');
  const role = (session.user as any)?.role;
  const userId = (session.user as any)?.userId;
  const links = role === 'committee' ? committeeLinks : teacherLinks;

  // เช็ค assignedYears แบบ realtime — token เก่าอาจไม่ sync ถ้า admin เพิ่งมอบหมาย
  let hasAssignedYears = true;
  if (['teacher', 'committee'].includes(role) && userId) {
    await dbConnect();
    const u: any = await User.findById(userId).select('assignedYears').lean();
    hasAssignedYears = Array.isArray(u?.assignedYears) && u.assignedYears.length > 0;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppShell
        links={hasAssignedYears ? links : []}
        extraRight={hasAssignedYears ? <NavYearSelector variant="desktop" /> : null}
      >
        {hasAssignedYears
          ? children
          : <NoAssignedYearsScreen role={role} fullName={(session.user as any)?.name} />}
      </AppShell>
      <Footer />
    </div>
  );
}
