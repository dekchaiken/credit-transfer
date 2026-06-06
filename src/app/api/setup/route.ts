import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { User } from '@/models/User';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await dbConnect();

    // Check if any admin exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return NextResponse.json({ error: 'Admin already exists' }, { status: 400 });
    }

    // Create admin
    const passwordHash = await bcrypt.hash('admin1234', 10);
    await User.create({
      username: 'admin',
      passwordHash,
      fullName: 'Administrator',
      role: 'admin'
    });

    return NextResponse.json({ success: true, message: 'Admin created: admin / admin1234' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
