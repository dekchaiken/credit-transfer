import mongoose from 'mongoose';
import { TransferSheet } from '../src/models/TransferSheet.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/credit_transfer';

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const sheets = await TransferSheet.find({}).lean();
  console.log(`Found ${sheets.length} sheets\n`);

  let updated = 0;
  for (const sheet of sheets) {
    let changed = false;
    const newSelections = sheet.selections.map((sel: any) => {
      // ถ้ามี groupNo (เลือก group แล้ว) แต่ selected ยังเป็น false หรือ undefined
      if (sel.groupNo != null && !sel.selected) {
        changed = true;
        return { ...sel, selected: true };
      }
      return sel;
    });

    if (changed) {
      await TransferSheet.findByIdAndUpdate(sheet._id, { selections: newSelections });
      updated++;
      console.log(`✓ Updated sheet ${sheet._id} (${newSelections.length} selections)`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total sheets: ${sheets.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Unchanged: ${sheets.length - updated}`);

  await mongoose.disconnect();
  console.log('\nDisconnected');
}

main().catch(console.error);
