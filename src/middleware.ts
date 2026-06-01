import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PUBLIC = ['/login', '/api/auth'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some(p => pathname.startsWith(p)) || pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  // force change password ครั้งแรก (ยกเว้น API endpoint สำหรับเปลี่ยนรหัส + หน้า change-password)
  if ((token as any).mustChangePassword
      && !pathname.startsWith('/change-password')
      && !pathname.startsWith('/api/users/me/password')) {
    return NextResponse.redirect(new URL('/change-password', req.url));
  }
  const role = (token as any).role as string;
  if (pathname.startsWith('/admin') && role !== 'admin') return NextResponse.redirect(new URL('/', req.url));
  if (pathname.startsWith('/teacher') && !['admin','teacher','committee'].includes(role)) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  if (pathname.startsWith('/student') && role !== 'student' && role !== 'admin') {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts).*)'],
};
