import mongoose from 'mongoose';
import { TransferSheet } from '../src/models/TransferSheet.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/credit_transfer';

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const studentId = '6a170cbf5ed83c1a433c4a09';
  const sheet = await TransferSheet.findOne({
    studentId: new mongoose.Types.ObjectId(studentId)
  }).lean();

  if (!sheet) {
    console.log(`No sheet found for student ${studentId}`);
    await mongoose.disconnect();
    return;
  }

  console.log('\n=== Sheet Info ===');
  console.log('Sheet ID:', sheet._id);
  console.log('Status:', sheet.status);
  console.log('Total selections:', sheet.selections.length);

  console.log('\n=== First 5 Selections ===');
  sheet.selections.slice(0, 5).forEach((sel: any, i: number) => {
    console.log(`\n[${i + 1}]`);
    console.log('  uniCourseId:', sel.uniCourseId);
    console.log('  groupNo:', sel.groupNo);
    console.log('  grade:', sel.grade || '(empty)');
    console.log('  selected:', sel.selected !== undefined ? sel.selected : '(undefined)');
    console.log('  outsideCE:', sel.outsideCE !== undefined ? sel.outsideCE : '(undefined)');
  });

  await mongoose.disconnect();
  console.log('\nDisconnected');
}

main().catch(console.error);
