import bcrypt from 'bcryptjs';
import { User } from '@/models/User';

export const DEFAULT_STUDENT_PASSWORD = '1234';

/** สร้าง user ของนักศึกษาอัตโนมัติ — username = รหัส นศ., password = "1234" (force change ครั้งแรก) */
export async function ensureStudentUser(studentId: string, fullName: string) {
  const existing = await User.findOne({ username: studentId });
  if (existing) return { created: false, user: existing };
  const passwordHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 10);
  const user = await User.create({
    username: studentId,
    passwordHash,
    fullName,
    role: 'student',
    studentId,
    mustChangePassword: true,
  });
  return { created: true, user };
}
