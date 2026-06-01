/**
 * One-shot migration to create the central UniCourse catalog + per-year CourseOfferings.
 *
 * Behavior:
 *  - Group UniCourses by NFC-normalized `code`.
 *  - If group has multiple docs with the SAME nameTh (after NFC+trim) → merge:
 *      keep oldest as canonical, repoint TransferGroups from others (renumbering
 *      groupNo on collision), delete other UniCourse docs.
 *  - If group has DIFFERENT nameTh values → SKIP merge, log conflict.
 *  - Always create one CourseOffering per (canonicalUniCourseId, yearId) pair,
 *    preserving the original `order`.
 *
 * Usage:
 *   npx tsx scripts/migrate-offerings.ts          # apply
 *   npx tsx scripts/migrate-offerings.ts --dry    # preview only
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { UniCourse } from '../src/models/UniCourse';
import { TransferGroup } from '../src/models/TransferGroup';
import { CourseOffering } from '../src/models/CourseOffering';

const DRY = process.argv.includes('--dry');

function norm(s: string) { return (s || '').normalize('NFC').trim(); }

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/credit_transfer';
  await mongoose.connect(uri);

  console.log(`\n=== migrate-offerings ${DRY ? '(DRY RUN)' : '(APPLY)'} ===\n`);

  const all = await UniCourse.find({}).sort({ createdAt: 1 }).lean();
  console.log(`found ${all.length} UniCourse docs`);

  const byCode = new Map<string, typeof all>();
  for (const c of all) {
    const key = norm(c.code);
    if (!byCode.has(key)) byCode.set(key, [] as any);
    (byCode.get(key) as any[]).push(c);
  }
  console.log(`unique codes: ${byCode.size}\n`);

  let merged = 0, conflicts = 0, offeringsCreated = 0, offeringsExisting = 0;

  for (const [code, group] of byCode) {
    if (group.length === 1) {
      // single course — just create offering
      const c = group[0];
      const r = await upsertOffering(c._id, c.yearId, c.order);
      if (r === 'created') offeringsCreated++; else offeringsExisting++;
      continue;
    }

    // multiple docs with same code
    const names = new Set(group.map((g: any) => norm(g.nameTh)));
    const canonical: any = group[0]; // oldest
    const others: any[] = group.slice(1);

    if (names.size > 1) {
      console.log(`⚠  CONFLICT [${code}] has ${group.length} docs with different nameTh:`);
      for (const g of group) console.log(`     - "${g.nameTh}" (year doc ${g.yearId})`);
      console.log(`     SKIPPING merge — creating offerings for each separately\n`);
      conflicts++;
      // still create offerings for each as separate catalog entries
      for (const g of group) {
        const r = await upsertOffering(g._id, g.yearId, g.order);
        if (r === 'created') offeringsCreated++; else offeringsExisting++;
      }
      continue;
    }

    // safe to merge
    console.log(`merge [${code}] "${canonical.nameTh}" — keeping ${canonical._id}, merging ${others.length} dup(s)`);

    for (const other of others) {
      const otherGroups = await TransferGroup.find({ uniCourseId: other._id }).sort({ groupNo: 1 }).lean();
      const canonGroups = await TransferGroup.find({ uniCourseId: canonical._id }).lean();
      const usedNos = new Set(canonGroups.map((g: any) => g.groupNo));
      let nextNo = canonGroups.length === 0 ? 1 : Math.max(...canonGroups.map((g: any) => g.groupNo)) + 1;

      for (const g of otherGroups as any[]) {
        if (usedNos.has(g.groupNo)) {
          console.log(`    repoint TransferGroup ${g._id}: groupNo ${g.groupNo} → ${nextNo} (collision)`);
          if (!DRY) await TransferGroup.updateOne({ _id: g._id }, { uniCourseId: canonical._id, groupNo: nextNo });
          usedNos.add(nextNo);
          nextNo++;
        } else {
          if (!DRY) await TransferGroup.updateOne({ _id: g._id }, { uniCourseId: canonical._id });
          usedNos.add(g.groupNo);
        }
      }

      if (!DRY) await UniCourse.deleteOne({ _id: other._id });
      merged++;
    }

    // create offering for canonical for EACH yearId in original group
    for (const g of group) {
      const r = await upsertOffering(canonical._id, g.yearId, g.order);
      if (r === 'created') offeringsCreated++; else offeringsExisting++;
    }
  }

  console.log(`\n=== summary ===`);
  console.log(`merged duplicates  : ${merged}`);
  console.log(`conflicts (skipped): ${conflicts}`);
  console.log(`offerings created  : ${offeringsCreated}`);
  console.log(`offerings existing : ${offeringsExisting}`);
  if (DRY) console.log(`\n(dry run — no changes written)`);

  await mongoose.disconnect();
}

async function upsertOffering(uniCourseId: any, yearId: any, order: number): Promise<'created' | 'exists'> {
  const found = await CourseOffering.findOne({ uniCourseId, yearId }).lean();
  if (found) return 'exists';
  if (!DRY) await CourseOffering.create({ uniCourseId, yearId, order: order || 0 });
  return 'created';
}

main().catch(e => { console.error(e); process.exit(1); });
