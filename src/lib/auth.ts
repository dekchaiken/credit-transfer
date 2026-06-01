import { authOptions } from '@/lib/authOptions';
import { getServerSession } from 'next-auth';

export type Role = 'admin' | 'teacher' | 'committee' | 'student';

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function requireRole(roles: Role[]) {
  const session = await getSession();
  const role = (session?.user as any)?.role as Role | undefined;
  if (!session || !role || !roles.includes(role)) {
    throw new Response('Unauthorized', { status: 401 });
  }
  return session;
}
