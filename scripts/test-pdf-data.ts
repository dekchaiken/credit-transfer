import mongoose from 'mongoose';
import { TransferSheet } from '../src/models/TransferSheet.js';
import { Student } from '../src/models/Student.js';
import { TransferGroup } from '../src/models/TransferGroup.js';
import { AcademicYear } from '../src/models/AcademicYear.js';
import { Program } from '../src/models/Program.js';
import { findCoursesByYearId } from '../src/lib/courseQueries.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/credit_transfer';

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const sheetId = '6a17174acc6ea5d75c995f81';
  const sheet: any = await TransferSheet.findById(sheetId).lean();
  if (!sheet) {
    console.log('Sheet not found');
    await mongoose.disconnect();
    return;
  }

  const student: any = await Student.findById(sheet.studentId).populate('yearId').populate('programId').lean();
  const courses = await findCoursesByYearId(String(student.yearId._id));
  const groups = await TransferGroup.find({ uniCourseId: { $in: courses.map((c: any) => c._id) } }).sort({ groupNo: 1 }).lean();

  console.log('=== PDF Data Preparation ===');
  console.log('Student:', student.fullName);
  console.log('Total courses:', courses.length);
  console.log('Total groups:', groups.length);
  console.log('Total selections:', sheet.selections.length);

  const selections = (sheet.selections || []).map((s: any) => ({
    uniCourseId: String(s.uniCourseId),
    groupNo: s.groupNo ?? null,
    grade: s.grade || '',
    outsideCE: !!s.outsideCE,
    selected: !!s.selected,
  }));

  console.log('\n=== Selections sent to PDF (first 4) ===');
  selections.slice(0, 4).forEach((sel: any, i: number) => {
    console.log(`\n[${i + 1}]`);
    console.log('  uniCourseId:', sel.uniCourseId);
    console.log('  groupNo:', sel.groupNo);
    console.log('  grade:', sel.grade || '(empty)');
    console.log('  selected:', sel.selected);
    console.log('  outsideCE:', sel.outsideCE);
  });

  console.log('\n=== Checking selByGroup map ===');
  const selByGroup = new Map<string, any>();
  for (const sel of selections) {
    if (sel.groupNo == null) continue;
    const key = `${sel.uniCourseId}|${sel.groupNo}`;
    selByGroup.set(key, sel);
    console.log(`Key: ${key.substring(0, 30)}... → selected: ${sel.selected}, outsideCE: ${sel.outsideCE}`);
  }

  await mongoose.disconnect();
  console.log('\nDisconnected');
}

main().catch(console.error);
