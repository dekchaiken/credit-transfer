import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { User } from '@/models/User';
import bcrypt from 'bcryptjs';

// ⚠️ SECURITY: ลบ endpoint นี้หลังจาก setup เสร็จแล้ว!
export async function POST(req: Request) {
  try {
    const { secret } = await req.json();

    // ป้องกันการเรียกใช้โดยไม่ได้รับอนุญาต
    if (secret !== process.env.SETUP_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // ตรวจสอบว่ามี admin อยู่แล้วหรือไม่
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return NextResponse.json({
        message: 'Admin already exists',
        username: existingAdmin.username
      });
    }

    // สร้าง admin user
    const hashedPassword = await bcrypt.hash('admin1234', 10);
    const admin = await User.create({
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      mustChangePassword: false,
    });

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully',
      username: admin.username,
      defaultPassword: 'admin1234',
      note: '⚠️ Please delete /api/setup/route.ts after setup!'
    });
  } catch (error: any) {
    console.error('Setup error:', error);
    return NextResponse.json({
      error: 'Setup failed',
      details: error.message
    }, { status: 500 });
  }
}
