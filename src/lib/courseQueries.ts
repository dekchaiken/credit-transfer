import { CourseOffering } from '@/models/CourseOffering';
import { UniCourse } from '@/models/UniCourse';

/**
 * Returns courses offered in a given AcademicYear, sorted by Offering.order.
 * Output shape mirrors the legacy UniCourse list so existing consumers
 * (uni-courses page, sheets, PDF) keep working without changes.
 */
export async function findCoursesByYearId(yearId: string) {
  const offerings = await CourseOffering.find({ yearId }).sort({ order: 1 }).lean();
  if (offerings.length === 0) return [];

  const courseIds = offerings.map((o: any) => o.uniCourseId);
  const courses = await UniCourse.find({ _id: { $in: courseIds } }).lean();
  const byId = new Map(courses.map((c: any) => [String(c._id), c]));

  return offerings
    .map((o: any) => {
      const c = byId.get(String(o.uniCourseId));
      if (!c) return null;
      return {
        _id: c._id,
        code: c.code,
        nameTh: c.nameTh,
        nameEn: c.nameEn,
        credits: c.credits,
        creditHours: c.creditHours,
        order: o.order,         // per-year order from Offering
        offeringId: o._id,      // for delete-from-year operations
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => (a.order - b.order) || String(a.code).localeCompare(String(b.code)));
}

/**
 * Find or create a UniCourse in the central catalog by NFC-normalized `code`.
 * Returns { course, isNew }. If found and `nameTh` mismatches, throws.
 */
export async function findOrCreateCatalogCourse(input: {
  code: string;
  nameTh: string;
  nameEn?: string;
  credits?: number;
  creditHours?: string;
  yearId?: string;     // optional: if provided, stored as the originating year on the catalog doc
  order?: number;
}) {
  const normCode = (input.code || '').normalize('NFC').trim();
  const normName = (input.nameTh || '').normalize('NFC').trim();

  const existing: any = await UniCourse.findOne({ code: normCode }).lean();
  if (existing) {
    const existingName = (existing.nameTh || '').normalize('NFC').trim();
    if (existingName !== normName) {
      const err: any = new Error(`code "${normCode}" already exists in catalog with different name "${existing.nameTh}"`);
      err.code = 'NAME_CONFLICT';
      throw err;
    }
    return { course: existing, isNew: false };
  }

  const created = await UniCourse.create({
    code: normCode,
    nameTh: input.nameTh,
    nameEn: input.nameEn || '',
    credits: input.credits ?? 3,
    creditHours: input.creditHours || '',
    order: input.order ?? 0,
    // yearId is optional — only set if caller is creating in legacy/year-scoped mode
    ...(input.yearId ? { yearId: input.yearId } : {}),
  });
  return { course: created, isNew: true };
}
