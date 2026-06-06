// Simulate the PUT /api/users/[id] update logic
// to confirm the schema and update path works
import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/User';

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/credit_transfer';
  await mongoose.connect(uri);

  const teacher = await (User as any).findOne({ username: 'teacher1' });
  if (!teacher) { console.log('no teacher1'); process.exit(1); }

  console.log('BEFORE:', { id: teacher._id, assignedYears: teacher.assignedYears });

  // Replicate the API's update logic exactly
  const body = { assignedYears: [2569, 2570] };
  const update: Record<string, any> = {};

  if (Array.isArray(body.assignedYears)) {
    const targetRole = teacher.role;
    if (['teacher', 'committee'].includes(targetRole)) {
      update.assignedYears = body.assignedYears
        .map((y: any) => Number(y))
        .filter((y: number) => Number.isFinite(y) && y > 0);
    } else {
      update.assignedYears = [];
    }
  }

  console.log('UPDATE OBJECT:', update);

  const updated = await (User as any).findByIdAndUpdate(teacher._id, update, { new: true })
    .select('-passwordHash').lean();

  console.log('AFTER:', { id: updated._id, assignedYears: updated.assignedYears });

  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
