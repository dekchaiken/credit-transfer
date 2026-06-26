import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import fs from 'fs';
import path from 'path';

// === Font registration ===
// Prefer locally-shipped TH Sarabun PSK from public/fonts/ if present.
// Otherwise fall back to Google's "Sarabun" (visually nearly identical).
const pskRegular = path.join(process.cwd(), 'public', 'fonts', 'THSarabunPSK.ttf');
const pskBold    = path.join(process.cwd(), 'public', 'fonts', 'THSarabunPSK-Bold.ttf');
const hasLocalPSK = (() => {
  try { return fs.existsSync(pskRegular) && fs.existsSync(pskBold); }
  catch { return false; }
})();

Font.register({
  family: 'TH Sarabun PSK',
  fonts: hasLocalPSK ? [
    { src: pskRegular, fontWeight: 400 },
    { src: pskBold,    fontWeight: 700 },
  ] : [
    { src: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sarabun/Sarabun-Regular.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sarabun/Sarabun-Bold.ttf',    fontWeight: 700 },
  ],
});

// Thai text doesn't use word spaces; without this, long Thai names overflow
// table cells. Splitting every char lets the engine wrap at any character.
Font.registerHyphenationCallback((word: string) => {
  if (!/[฀-๿]/.test(word)) return [word];
  return word.split('');
});

const PINK = '#F4D7D7';
const BORDER = '#000';
const DOT = '#444';

// === Layout math ===
// A4 width = 595pt. Page horizontal padding = 26pt each side. Usable = 543pt.
const PAGE_HPAD = 26;
const USABLE = 595 - PAGE_HPAD * 2; // 543

// Column widths (sum = USABLE)
const W = {
  code:    USABLE * 0.09,  // รหัสวิชา (มหาลัย)
  name:    USABLE * 0.18,  // ชื่อวิชา (มหาลัย)
  cred:    USABLE * 0.08,  // หน่วยกิต (มหาลัย)
  grp:     USABLE * 0.05,  // กลุ่มเทียบ
  extCode: USABLE * 0.10,  // รหัสวิชา (ext)
  extName: USABLE * 0.23,  // ชื่อวิชา (ext)
  extCred: USABLE * 0.08,  // หน่วยกิต (ext)
  grade:   USABLE * 0.06,  // เกรด
  check:   USABLE * 0.06,  // เลือก ✓
  ce:      USABLE * 0.07,  // นอกระบบ CE
  // Derived
  merged:    0,
  extArea:   0,
  identity:  0,
  groupArea: 0,
};
W.merged    = W.extCode + W.extName + W.extCred;
W.extArea   = W.merged;
W.identity  = W.code + W.name + W.cred;
W.groupArea = W.grp + W.extArea + W.grade + W.check + W.ce;

const s = StyleSheet.create({
  page: {
    paddingTop: 20, paddingBottom: 56, paddingHorizontal: PAGE_HPAD,
    fontSize: 9, fontFamily: 'TH Sarabun PSK', color: '#000',
  },

  // === Top header (fixed every page) ===
  formCodeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6 },
  formCode: { fontSize: 12 },

  topHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  uniBlock: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '52%' },
  uniLogo: { width: 48, height: 52, objectFit: 'contain' },
  uniNameWrap: { flexDirection: 'column' },
  uniNameTh: { fontSize: 14 },
  uniNameEn: { fontSize: 10.5, color: '#222' },

  rightTitle: { flex: 1, textAlign: 'right', flexDirection: 'column' },
  title: { fontSize: 13, fontWeight: 700, textAlign: 'right' },
  subtitle: { fontSize: 12.5, fontWeight: 700, marginTop: 1, textAlign: 'right' },

  hr: { borderBottomWidth: 0.5, borderColor: BORDER, marginBottom: 6 },

  // === Student info (page 1 only) ===
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-end', marginVertical: 3.5, fontSize: 11,
  },
  infoLabel: { fontWeight: 700 },
  infoValue: { paddingHorizontal: 4 },
  infoUnderline: {
    flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: DOT,
    marginHorizontal: 3, alignItems: 'center',
  },
  infoFixedDots: {
    width: 90, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: DOT,
    marginHorizontal: 3, alignItems: 'center',
  },
  infoSpacer: { width: 14 },
  infoBlockBefore: { marginBottom: 6 },
  infoTextInline: { paddingHorizontal: 2 },

  // === Table ===
  // No border on the table container itself — when @react-pdf wraps a
  // bordered View across pages, the left/top borders extend down through
  // the empty trailing space of each page. Put borders on cells instead.
  table: {},

  // Header row
  thRow: { flexDirection: 'row' },
  thCell: {
    backgroundColor: PINK,
    borderTopWidth: 0.5,
    borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: BORDER,
    paddingVertical: 4, paddingHorizontal: 2,
    textAlign: 'center', fontSize: 9, fontWeight: 700,
    justifyContent: 'center', alignItems: 'center',
  },
  thFullH: { height: 44 },
  thHalfH: { height: 22 },
  thColumnGroup: { flexDirection: 'column' },
  thRowGroup: { flexDirection: 'row' },

  // Body row containers — borders live on cells, not containers, so each
  // visible line is owned by exactly one element and gaps never appear.
  rowBorder: {},
  rowFill: { flexGrow: 1 },
  courseRow: { flexDirection: 'row' },
  groupRow: { flexDirection: 'row' },
  extRow: { flexDirection: 'row' },

  // Cell base — every cell owns its right + bottom borders.
  cell: {
    borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: BORDER,
    paddingVertical: 3.5, paddingHorizontal: 3, fontSize: 9,
  },
  cellVCenter: { justifyContent: 'center' },
  cellInner: { fontSize: 9 },
  cellInnerCenter: { fontSize: 9, textAlign: 'center' },

  // Column width helpers (absolute pt)
  wCode:    { width: W.code, borderLeftWidth: 0.5, borderColor: BORDER, textAlign: 'center' },
  wName:    { width: W.name },
  wCred:    { width: W.cred, textAlign: 'center' },
  wGrp:     { width: W.grp, textAlign: 'center' },
  wExtCode: { width: W.extCode, textAlign: 'center' },
  wExtName: { width: W.extName },
  wExtCred: { width: W.extCred, textAlign: 'center' },
  wGrade:   { width: W.grade, textAlign: 'center' },
  wCheck:   { width: W.check, textAlign: 'center' },
  wCE:      { width: W.ce, textAlign: 'center' },

  wMerged:    { width: W.merged },
  wIdentity:  { width: W.identity },
  wGroupArea: { width: W.groupArea, flexDirection: 'column' },
  wExtArea:   { width: W.extArea, flexDirection: 'column' },

  // === Summary + signatures (last page) ===
  summary: { marginTop: 18, fontSize: 11, flexDirection: 'row', alignItems: 'center' },
  summaryLabel: { fontWeight: 700 },
  summaryValue: {
    width: 80, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: DOT,
    marginHorizontal: 4, textAlign: 'center', paddingHorizontal: 4,
  },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 36 },
  signCol: { width: '32%', alignItems: 'center' },
  signLine: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end',
    fontSize: 10.5, marginBottom: 2, width: '100%',
  },
  signDots: { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: DOT, marginHorizontal: 2 },
  signCaption: { fontSize: 10, marginTop: 2, textAlign: 'center' },

  // === Page footer ===
  pageFooter: {
    position: 'absolute', left: PAGE_HPAD, right: PAGE_HPAD, bottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: 0.5, borderColor: '#aaa', paddingTop: 6,
  },
  ascarLogo: { width: 48, height: 28, objectFit: 'contain' },
  pageFooterTextWrap: { flexDirection: 'column' },
  pageFooterText: { fontSize: 12, color: '#000' },
  pageFooterEn: { fontSize: 9, color: '#000' },

  logoPlaceholder: {
    width: 40, height: 44, borderWidth: 1, borderColor: '#ccc', borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  logoPlaceholderText: { fontSize: 6, color: '#999', textAlign: 'center' },
});

type Ext = { code: string; nameTh: string; credits: string };
type Group = { _id: string; uniCourseId: string; groupNo: number; externalCourses: Ext[]; requireAll?: boolean };
type Course = { _id: string; code: string; nameTh: string; nameEn?: string; creditHours?: string; credits?: number };
type Selection = { uniCourseId: string; groupNo: number | null; grade: string; outsideCE: boolean; selected: boolean; externalCourseCode?: string | null };

type Props = {
  student: {
    studentId: string;
    fullName: string;
    programId: { nameTh: string; faculty?: string };
    yearId: { year: number };
    level: string;
  };
  courses: Course[];
  groups: Group[];
  selections: Selection[];
  committee: { name: string; role?: string }[];
  signMonthYear: string;
  rmutkLogo?: string;
  ascarLogo?: string;
};

// Strip a leading "สาขาวิชา" / "สาขา " / "สาขาวิชา " prefix to avoid the
// label being rendered twice when the user has stored it in the program name.
function stripProgramPrefix(name: string | undefined): string {
  if (!name) return '';
  return name.normalize('NFC').trim().replace(/^สาขา(วิชา)?\s*/, '');
}

// Repeating top header on every page
function TopHeader({ student, rmutkLogo }: Pick<Props, 'student' | 'rmutkLogo'>) {
  const programName = stripProgramPrefix(student.programId?.nameTh);
  return (
    <View fixed>
      {/* Row 1: form code top-right alone */}
      <View style={s.formCodeRow}>
        <Text style={s.formCode}>สวท. 12 –05</Text>
      </View>

      {/* Row 2: logo + univ name on left, title + subtitle on right */}
      <View style={s.topHeader}>
        <View style={s.uniBlock}>
          {rmutkLogo ? (
            <Image src={rmutkLogo} style={s.uniLogo} />
          ) : (
            <View style={s.logoPlaceholder}>
              <Text style={s.logoPlaceholderText}>โลโก้{'\n'}มทร.</Text>
            </View>
          )}
          <View style={s.uniNameWrap}>
            <Text style={s.uniNameTh}>มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ</Text>
            <Text style={s.uniNameEn}>Rajamangala University of Technology</Text>
          </View>
        </View>
        <View style={s.rightTitle}>
          <Text style={s.title}>ตารางการเทียบวิชาเรียนและโอนหน่วยกิตการศึกษาในระบบ</Text>
          <Text style={s.subtitle}>
            สาขาวิชา{programName}  (เข้าศึกษาปี {student.yearId?.year || ''})
          </Text>
        </View>
      </View>
      <View style={s.hr} />
    </View>
  );
}

function PageFooter({ ascarLogo }: Pick<Props, 'ascarLogo'>) {
  return (
    <View style={s.pageFooter} fixed>
      {ascarLogo ? (
        <Image src={ascarLogo} style={s.ascarLogo} />
      ) : (
        <View style={[s.logoPlaceholder, { width: 48, height: 28 }]}>
          <Text style={s.logoPlaceholderText}>ASCAR</Text>
        </View>
      )}
      <View style={s.pageFooterTextWrap}>
        <Text style={s.pageFooterText}>สำนักส่งเสริมวิชาการและงานทะเบียน</Text>
        <Text style={s.pageFooterEn}>Academic Support Center and Registration</Text>
      </View>
    </View>
  );
}

// Table header: 2 visual rows; "รายวิชาที่ขอเทียบโอน" spans 3 sub-cols.
// Use the same thCell pattern everywhere so all texts render reliably.
function TableHeader() {
  return (
    <View style={s.thRow} fixed>
      <View style={[s.thCell, s.wCode, s.thFullH]}><Text>รหัสวิชา</Text></View>
      <View style={[s.thCell, s.wName, s.thFullH]}><Text>ชื่อวิชา</Text></View>
      <View style={[s.thCell, s.wCred, s.thFullH]}><Text>หน่วยกิต</Text></View>
      <View style={[s.thCell, s.wGrp, s.thFullH]}><Text>กลุ่ม{'\n'}เทียบ</Text></View>

      {/* Merged column: top label + 3 sub-cells stacked vertically */}
      <View style={[s.thColumnGroup, s.wMerged]}>
        <View style={[s.thCell, s.wMerged, s.thHalfH]}>
          <Text>รายวิชาที่ขอเทียบโอน (จะต้องได้เกรด C หรือ 2 ขึ้นไป)</Text>
        </View>
        <View style={s.thRowGroup}>
          <View style={[s.thCell, s.wExtCode, s.thHalfH]}><Text>รหัสวิชา</Text></View>
          <View style={[s.thCell, s.wExtName, s.thHalfH]}><Text>ชื่อวิชา</Text></View>
          <View style={[s.thCell, s.wExtCred, s.thHalfH]}><Text>หน่วยกิต</Text></View>
        </View>
      </View>

      <View style={[s.thCell, s.wGrade, s.thFullH]}><Text>เกรด</Text></View>
      <View style={[s.thCell, s.wCheck, s.thFullH]}><Text>เลือก{'\n'}(✓)</Text></View>
      <View style={[s.thCell, s.wCE, s.thFullH]}><Text>นอก{'\n'}ระบบ{'\n'}CE</Text></View>
    </View>
  );
}

// Render one course as a single tall outer row, with rowspan for identity cells
function CourseRow({
  course, groups, selByExt,
}: {
  course: Course;
  groups: Group[];
  selByExt: Map<string, Selection>;
}) {
  const credText = course.creditHours || (course.credits != null ? String(course.credits) : '');
  const courseNameText = course.nameTh + (course.nameEn ? `\n(${course.nameEn})` : '');

  // No groups → flat single empty row
  if (groups.length === 0) {
    return (
      <View style={s.courseRow} wrap={false}>
        <View style={[s.cell, s.wCode]}><Text>{course.code}</Text></View>
        <View style={[s.cell, s.wName]}><Text>{courseNameText}</Text></View>
        <View style={[s.cell, s.wCred]}><Text style={s.cellInnerCenter}>{credText}</Text></View>
        <Text style={[s.cell, s.wGrp]}></Text>
        <Text style={[s.cell, s.wExtCode]}></Text>
        <Text style={[s.cell, s.wExtName]}></Text>
        <Text style={[s.cell, s.wExtCred]}></Text>
        <Text style={[s.cell, s.wGrade]}></Text>
        <Text style={[s.cell, s.wCheck]}></Text>
        <Text style={[s.cell, s.wCE]}></Text>
      </View>
    );
  }

  return (
    <View style={s.courseRow} wrap={false}>
      {/* Identity cells — span full course height, top-aligned per ref */}
      <View style={[s.cell, s.wCode]}><Text>{course.code}</Text></View>
      <View style={[s.cell, s.wName]}><Text>{courseNameText}</Text></View>
      <View style={[s.cell, s.wCred]}><Text style={s.cellInnerCenter}>{credText}</Text></View>

      {/* Group stack — fills remaining width */}
      <View style={s.wGroupArea}>
        {groups.map((g, gi) => {
          const isLastGroup = gi === groups.length - 1;
          return (
            <View key={g._id || `${course._id}-${g.groupNo}`}
              style={isLastGroup ? [s.groupRow, s.rowFill] : [s.groupRow]}>
              <View style={[s.cell, s.wGrp, s.cellVCenter]}>
                <Text style={s.cellInnerCenter}>{g.groupNo}</Text>
              </View>
              {/* code/name/cred/grade/check per ext-course row */}
              <View style={{ width: W.extArea + W.grade + W.check, flexDirection: 'column' }}>
                {g.externalCourses.map((ex, ei) => {
                  const isLastExt = ei === g.externalCourses.length - 1;
                  const extSel = selByExt.get(`${String(course._id)}|${g.groupNo}|${ex.code}`)
                    ?? selByExt.get(`${String(course._id)}|${g.groupNo}|__group__`);
                  const isSel = !!extSel;
                  return (
                    <View key={ei} style={isLastExt ? [s.extRow, s.rowFill] : [s.extRow]}>
                      <Text style={[s.cell, s.wExtCode]}>{ex.code}</Text>
                      <Text style={[s.cell, s.wExtName]}>{ex.nameTh}</Text>
                      <Text style={[s.cell, s.wExtCred]}>{ex.credits}</Text>
                      <Text style={[s.cell, s.wGrade, { textAlign: 'center' }]}>{isSel ? (extSel!.grade || '') : ''}</Text>
                      <Text style={[s.cell, s.wCheck, { textAlign: 'center' }]}>{extSel?.selected ? '/' : extSel ? 'X' : ''}</Text>
                    </View>
                  );
                })}
              </View>
              {/* CE spans all ext rows (same as check) */}
              {(() => {
                const anyOutsideCE = g.externalCourses.some(ex => {
                  const es = selByExt.get(`${String(course._id)}|${g.groupNo}|${ex.code}`)
                    ?? selByExt.get(`${String(course._id)}|${g.groupNo}|__group__`);
                  return es?.outsideCE;
                });
                return (
                  <View style={[s.cell, s.wCE, s.cellVCenter]}>
                    <Text style={s.cellInnerCenter}>{anyOutsideCE ? '/' : ''}</Text>
                  </View>
                );
              })()}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function TransferSheetPDF({
  student, courses, groups, selections, committee, signMonthYear, rmutkLogo, ascarLogo,
}: Props) {
  const groupsByUni = new Map<string, Group[]>();
  for (const g of groups) {
    const k = String(g.uniCourseId);
    if (!groupsByUni.has(k)) groupsByUni.set(k, []);
    groupsByUni.get(k)!.push(g);
  }
  const selByExt = new Map<string, Selection>();
  for (const sel of selections) {
    if (sel.groupNo == null) continue;
    const k = sel.externalCourseCode
      ? `${String(sel.uniCourseId)}|${sel.groupNo}|${sel.externalCourseCode}`
      : `${String(sel.uniCourseId)}|${sel.groupNo}|__group__`;
    selByExt.set(k, sel);
  }
  function groupPassesPdf(g: Group, uniId: string): boolean {
    const gSels = selections.filter(s => String(s.uniCourseId) === uniId && s.groupNo === g.groupNo);
    const extSels = gSels.filter(s => s.externalCourseCode);
    if (extSels.length === 0) return gSels.some(s => s.selected);
    if (g.requireAll) return g.externalCourses.every(ex => extSels.find(s => s.externalCourseCode === ex.code)?.selected === true);
    return extSels.some(s => s.selected);
  }
  const transferredCount = new Set(
    courses.filter(c => (groupsByUni.get(String(c._id)) || []).some(g => groupPassesPdf(g, String(c._id)))).map(c => String(c._id)),
  ).size;

  const committeeFilled = (committee.length ? committee : [
    { name: '', role: 'กรรมการ' },
    { name: '', role: 'กรรมการ' },
    { name: '', role: 'กรรมการ' },
  ]).slice(0, 3);
  while (committeeFilled.length < 3) committeeFilled.push({ name: '', role: 'กรรมการ' });

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <TopHeader student={student} rmutkLogo={rmutkLogo} />

        {/* === Student info — page 1 only === */}
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>รหัสประจำตัวนักศึกษา</Text>
          <View style={s.infoUnderline}>
            <Text style={s.infoValue}>{student.studentId}</Text>
          </View>
          <View style={s.infoSpacer} />
          <Text style={s.infoLabel}>ชื่อ-สกุล</Text>
          <View style={s.infoUnderline}>
            <Text style={s.infoValue}>{student.fullName}</Text>
          </View>
        </View>
        <View style={[s.infoRow, s.infoBlockBefore]}>
          {/* "สาขาวิชา{name}" — inline, no dotted underline */}
          <Text style={s.infoLabel}>สาขาวิชา</Text>
          <Text style={s.infoTextInline}>{stripProgramPrefix(student.programId?.nameTh)}</Text>
          <View style={s.infoSpacer} />

          {/* "ระดับการศึกษา {value}" — value followed by dotted blank */}
          <Text style={s.infoLabel}>ระดับการศึกษา</Text>
          <Text style={s.infoTextInline}>{student.level || 'เทียบโอน'}</Text>
          <View style={s.infoFixedDots} />
          <View style={s.infoSpacer} />

          {/* "คณะ {name}" — inline, no dotted underline */}
          <Text style={s.infoLabel}>คณะ</Text>
          <Text style={s.infoTextInline}>{student.programId?.faculty || ''}</Text>
        </View>

        <View style={s.table}>
          <TableHeader />
          {courses.map(c => (
            <CourseRow
              key={c._id}
              course={c}
              groups={groupsByUni.get(String(c._id)) || []}
              selByExt={selByExt}
            />
          ))}
        </View>

        {/* Summary + signatures — last page only */}
        <View style={s.summary}>
          <Text style={s.summaryLabel}>สรุปจำนวนรายวิชาที่ขอเทียบโอนได้</Text>
          <Text style={s.summaryValue}>{transferredCount}</Text>
          <Text>วิชา</Text>
        </View>

        <View style={s.signRow}>
          {committeeFilled.map((c, i) => (
            <View key={i} style={s.signCol}>
              <View style={s.signLine}>
                <Text>ลงชื่อ</Text>
                <View style={s.signDots} />
                <Text>{c.role || 'กรรมการ'}</Text>
              </View>
              <Text style={s.signCaption}>({c.name || '...........................................'})</Text>
              <Text style={s.signCaption}>{signMonthYear || '...........................'}</Text>
            </View>
          ))}
        </View>

        <PageFooter ascarLogo={ascarLogo} />
      </Page>
    </Document>
  );
}
