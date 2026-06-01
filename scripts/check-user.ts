import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/User';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/credit_transfer';

async function main() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');

  const username = process.argv[2] || 'testteacher1';
  const testPassword = process.argv[3] || '';

  const user = await User.findOne({ username }).lean();

  if (!user) {
    console.log(`❌ User "${username}" not found in database`);
    console.log('\nAll users:');
    const allUsers = await User.find().select('username role').lean();
    allUsers.forEach(u => console.log(`  - ${u.username} (${u.role})`));
  } else {
    console.log(`✅ User found: ${user.username}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Full name: ${user.fullName || '(empty)'}`);
    console.log(`   Password hash: ${user.passwordHash.substring(0, 30)}...`);
    console.log(`   Hash format valid: ${user.passwordHash.startsWith('$2') ? '✅' : '❌'}`);
    console.log(`   Must change password: ${user.mustChangePassword || false}`);

    if (testPassword) {
      console.log(`\n🔐 Testing password: "${testPassword}"`);
      const match = await bcrypt.compare(testPassword, user.passwordHash);
      console.log(`   Result: ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
