import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function Home() {
  const session = await getSession();
  if (!session) redirect('/login');
  if ((session.user as any)?.mustChangePassword) redirect('/change-password');
  const role = (session.user as any)?.role;
  if (role === 'admin') redirect('/admin');
  if (role === 'teacher' || role === 'committee') redirect('/teacher');
  if (role === 'student') redirect('/student');
  redirect('/login');
}
