// Quick DB inspection — list teacher/committee users and assignedYears
import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/User';

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/credit_transfer';
  await mongoose.connect(uri);
  const users = await (User as any).find({ role: { $in: ['teacher', 'committee'] } })
    .select('_id username role assignedYears')
    .lean();
  console.log(JSON.stringify(users, null, 2));
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
