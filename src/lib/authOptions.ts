import { type AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { dbConnect } from '@/lib/db';
import { User } from '@/models/User';

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('[AUTH] Starting authorize for:', credentials?.username);
        if (!credentials?.username || !credentials?.password) {
          console.log('[AUTH] Missing credentials');
          return null;
        }
        try {
          await dbConnect();
          console.log('[AUTH] DB connected');
          const user: any = await User.findOne({ username: credentials.username }).lean();
          console.log('[AUTH] User found:', !!user);
          if (!user) return null;
          const ok = await bcrypt.compare(credentials.password, user.passwordHash);
          console.log('[AUTH] Password match:', ok);
          if (!ok) return null;
          return {
            id: String(user._id),
            name: user.fullName || user.username,
            email: user.username,
            role: user.role,
            studentId: user.studentId || null,
            mustChangePassword: !!user.mustChangePassword,
          } as any;
        } catch (error) {
          console.error('[AUTH] Error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as any).role;
        token.userId = (user as any).id;
        token.studentId = (user as any).studentId;
        token.mustChangePassword = (user as any).mustChangePassword;
      }
      if (trigger === 'update') {
        if (session?.mustChangePassword !== undefined) {
          token.mustChangePassword = !!session.mustChangePassword;
        } else if (token.userId) {
          await dbConnect();
          const u = await User.findById(token.userId).lean<{ mustChangePassword?: boolean }>();
          if (u) token.mustChangePassword = !!u.mustChangePassword;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).userId = token.userId;
        (session.user as any).studentId = token.studentId;
        (session.user as any).mustChangePassword = token.mustChangePassword;
      }
      return session;
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
};
