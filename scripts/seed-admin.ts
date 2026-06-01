import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/User';

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/credit_transfer';
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin1234';

  await mongoose.connect(uri);
  const existing = await User.findOne({ username });
  if (existing) {
    console.log(`admin "${username}" already exists`);
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ username, passwordHash, fullName: 'Administrator', role: 'admin' });
    console.log(`created admin: ${username} / ${password}`);
  }
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
