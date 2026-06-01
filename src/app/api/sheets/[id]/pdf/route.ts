import { NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { dbConnect } from '@/lib/db';
import { TransferSheet } from '@/models/TransferSheet';
import { Student } from '@/models/Student';
import { TransferGroup } from '@/models/TransferGroup';
import { TransferSheetPDF } from '@/components/pdf/TransferSheetPDF';
import { getSession } from '@/lib/auth';
import { findCoursesByYearId } from '@/lib/courseQueries';

export const dynamic = 'force-dynamic';

function loadLogoDataUrl(filename: string): string | undefined {
  try {
    const p = path.join(process.cwd(), 'public', 'logo', filename);
    if (!fs.existsSync(p)) return undefined;
    const buf = fs.readFileSync(p);
    const ext = path.extname(filename).slice(1).toLowerCase() || 'png';
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch { return undefined; }
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });
  await dbConnect();
  const { id } = await params;

  const sheet: any = await TransferSheet.findById(id).lean();
  if (!sheet) return new Response('not found', { status: 404 });
  const student: any = await Student.findById(sheet.studentId).populate('yearId').populate('programId').lean();

  const role = (session.user as any).role;
  if (role === 'student') {
    const sid = (session.user as any).studentId;
    if (student.studentId !== sid) return new Response('forbidden', { status: 403 });
  }

  const courses = await findCoursesByYearId(String(student.yearId._id));
  const groups = await TransferGroup.find({ uniCourseId: { $in: courses.map((c: any) => c._id) } }).sort({ groupNo: 1 }).lean();

  const rmutkLogo = loadLogoDataUrl('logoRMUTT-back.png') || loadLogoDataUrl('rmutk.png');
  const ascarLogo = loadLogoDataUrl('ASCAR.png') || loadLogoDataUrl('ascar.png');

  const selections = (sheet.selections || []).map((s: any) => ({
    uniCourseId: String(s.uniCourseId),
    groupNo: s.groupNo ?? null,
    grade: s.grade || '',
    outsideCE: !!s.outsideCE,
    selected: !!s.selected,
  }));

  const stream = await renderToStream(
    React.createElement(TransferSheetPDF as any, {
      student: {
        studentId: student.studentId,
        fullName: student.fullName,
        programId: { nameTh: student.programId?.nameTh, faculty: student.programId?.faculty },
        yearId: { year: student.yearId?.year },
        level: student.level || 'เทียบโอน',
      },
      courses: courses as any,
      groups: groups as any,
      selections: selections,
      committee: sheet.committee || [],
      signMonthYear: sheet.signMonthYear || '',
      rmutkLogo,
      ascarLogo,
    }) as any
  );

  return new Response(stream as any, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="transfer-${student.studentId}.pdf"`,
    },
  });
}
