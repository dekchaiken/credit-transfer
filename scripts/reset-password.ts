import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/User';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/credit_transfer';

async function main() {
  const username = process.argv[2];
  const newPassword = process.argv[3];

  if (!username || !newPassword) {
    console.log('Usage: npx tsx scripts/reset-password.ts <username> <new-password>');
    console.log('Example: npx tsx scripts/reset-password.ts testteacher1 newpass123');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const user = await User.findOne({ username });
  if (!user) {
    console.log(`❌ User "${username}" not found`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await User.updateOne({ username }, { passwordHash });

  console.log(`✅ Password reset for user: ${username}`);
  console.log(`   New password: ${newPassword}`);
  console.log(`\nYou can now login with:`);
  console.log(`   Username: ${username}`);
  console.log(`   Password: ${newPassword}`);

  await mongoose.disconnect();
}

main().catch(console.error);
