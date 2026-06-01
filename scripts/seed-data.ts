import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/User';
import { Program } from '../src/models/Program';
import { Faculty } from '../src/models/Faculty';
import { AcademicYear } from '../src/models/AcademicYear';
import { UniCourse } from '../src/models/UniCourse';
import { TransferGroup } from '../src/models/TransferGroup';
import { Student } from '../src/models/Student';

// === คณะของ มทร.กรุงเทพ (RMUTK) ===
const FACULTIES = [
  { nameTh: 'คณะบริหารธุรกิจ', nameEn: 'Faculty of Business Administration' },
  { nameTh: 'คณะวิทยาศาสตร์และเทคโนโลยี', nameEn: 'Faculty of Science and Technology' },
  { nameTh: 'คณะวิศวกรรมศาสตร์', nameEn: 'Faculty of Engineering' },
  { nameTh: 'คณะครุศาสตร์อุตสาหกรรม', nameEn: 'Faculty of Industrial Education' },
  { nameTh: 'คณะศิลปศาสตร์', nameEn: 'Faculty of Liberal Arts' },
  { nameTh: 'คณะอุตสาหกรรมสิ่งทอและออกแบบแฟชั่น', nameEn: 'Faculty of Textile Industries and Fashion Design' },
  { nameTh: 'คณะเทคโนโลยีคหกรรมศาสตร์', nameEn: 'Faculty of Home Economics Technology' },
];

// === ข้อมูลจริงจาก PDF "สวท. 12-05 ปี 2569" ===

const PROGRAM = {
  code: 'IT-DBT',
  nameTh: 'สาขาวิชาเทคโนโลยีสารสนเทศและธุรกิจดิจิทัล',
  nameEn: 'Information Technology and Digital Business',
  faculty: 'คณะบริหารธุรกิจ',
};

const YEAR = 2569;

type ExtRow = { code: string; nameTh: string; credits: string };
type CourseDef = {
  code: string; nameTh: string; nameEn: string; creditHours: string;
  groups: ExtRow[][];      // groups[i] = แต่ละกลุ่มเทียบ มีหลายวิชาภายใน
};

const COURSES: CourseDef[] = [
  {
    code: '5-155-302', nameTh: 'การฝึกงาน', nameEn: 'Job Training', creditHours: '3(0-40-0)',
    groups: [
      [{ code: '30202-8001', nameTh: 'ฝึกงาน', credits: '4' }],
      [{ code: '30204-8001', nameTh: 'ฝึกงาน', credits: '4' }],
      [{ code: '30901-8001', nameTh: 'ฝึกงาน', credits: '4' }],
      [{ code: '391-19-01', nameTh: 'ฝึกประสบการณ์สมรรถนะวิชาชีพ', credits: '4' }],
      [{ code: '30204-8002', nameTh: 'ฝึกงาน', credits: '4' }],
      [{ code: '30204-8003', nameTh: 'ฝึกงาน', credits: '4' }],
      [
        { code: '30000-2005', nameTh: 'กิจกรรมในสถานประกอบการ 1', credits: '(0-2-0)' },
        { code: '31910-2001', nameTh: 'การบริหารจัดการความต้องการทางธุรกิจ', credits: '3' },
      ],
      [
        { code: '30000-2005', nameTh: 'กิจกรรมในสถานประกอบการ 1', credits: '(0-2-0)' },
        { code: '31910-2010', nameTh: 'สื่อสร้างสรรค์ธุรกิจดิจิทัล', credits: '3' },
      ],
      [
        { code: '30000-2005', nameTh: 'กิจกรรมในสถานประกอบการ 1', credits: '(0-2-0)' },
        { code: '31910-2018', nameTh: 'การผลิตสื่อมัลติมีเดียสำหรับธุรกิจ', credits: '3' },
      ],
      [
        { code: '30000-2005', nameTh: 'กิจกรรมในสถานประกอบการ 1', credits: '(0-2-0)' },
        { code: '31910-2008', nameTh: 'การประยุกต์ AI สำหรับงานธุรกิจ', credits: '3' },
      ],
      [
        { code: '30000-2005', nameTh: 'กิจกรรมในสถานประกอบการ 1', credits: '(0-2-0)' },
        { code: '30001-1002', nameTh: 'องค์การและการบริหารงานคุณภาพ', credits: '3' },
      ],
      [
        { code: '30000-2005', nameTh: 'กิจกรรมในสถานประกอบการ 1', credits: '(0-2-0)' },
        { code: '31901-2014', nameTh: 'การให้ความช่วยเหลือและแก้ปัญหาด้านระบบเทคโนโลยีสารสนเทศ', credits: '3' },
      ],
    ],
  },
  {
    code: '5-151-121', nameTh: 'การพัฒนาโปรแกรมคอมพิวเตอร์', nameEn: 'Computer Programming', creditHours: '3(0-6-3)',
    groups: [
      [{ code: '30204-2005', nameTh: 'การเขียนโปรแกรมคอมพิวเตอร์', credits: '3' }],
      [{ code: '30901-1001', nameTh: 'การโปรแกรมคอมพิวเตอร์เชิงโครงสร้าง', credits: '3' }],
      [{ code: '30204-2005', nameTh: 'การโปรแกรมเชิงวัตถุ', credits: '3' }],
      [{ code: '396-12-01', nameTh: 'การโปรแกรมคอมพิวเตอร์', credits: '3' }],
      [{ code: '31910-2005', nameTh: 'การเขียนโปรแกรมเชิงวัตถุ', credits: '3' }],
      [{ code: '31901-2006', nameTh: 'การพัฒนาซอฟต์แวร์เชิงวัตถุ', credits: '3' }],
    ],
  },
  {
    code: '5-151-122', nameTh: 'ซอฟต์แวร์ประยุกต์ทางธุรกิจ', nameEn: 'Business Application Software', creditHours: '3(0-6-3)',
    groups: [
      [{ code: '30001-2001', nameTh: 'เทคโนโลยีสารสนเทศเพื่อการจัดการอาชีพ', credits: '3' }],
      [{ code: '396-11-01', nameTh: 'เทคโนโลยีดิจิทัลเพื่อการจัดการอาชีพ', credits: '3' }],
      [{ code: '30001-2003', nameTh: 'เทคโนโลยีดิจิทัลเพื่อการจัดการอาชีพ', credits: '3' }],
      [{ code: '30001-1003', nameTh: 'การประยุกต์ใช้เทคโนโลยีดิจิทัลในอาชีพ', credits: '3' }],
    ],
  },
  {
    code: '5-151-222', nameTh: 'วัสดุคอมพิวเตอร์และระบบสมองกลฝังตัว', nameEn: 'Computer Materials and Embedded System', creditHours: '3(3-0-6)',
    groups: [
      [
        { code: '30900-0004', nameTh: 'งานติดตั้งระบบคอมพิวเตอร์เบื้องต้น', credits: '3' },
        { code: '30901-2017', nameTh: 'พื้นฐานเทคโนโลยีระบบสมองกลฝังตัวและไอโอที', credits: '3' },
      ],
      [
        { code: '30204-2304', nameTh: 'การบำรุงรักษาคอมพิวเตอร์และอุปกรณ์พกพา', credits: '3' },
        { code: '30204-2104', nameTh: 'อินเทอร์เน็ตสรรพสิ่งสำหรับธุรกิจดิจิทัล', credits: '3' },
      ],
      [{ code: '31910-2012', nameTh: 'อินเทอร์เน็ตเพื่อสรรพสิ่ง', credits: '3' }],
      [{ code: '31901-2010', nameTh: 'การประยุกต์ใช้ระบบไอโอทีในชีวิตประจำวัน', credits: '3' }],
      [{ code: '31909-1002', nameTh: 'เทคโนโลยี IoT', credits: '3' }],
    ],
  },
  {
    code: '5-152-131', nameTh: 'โครงสร้างข้อมูลและอัลกอริทึม', nameEn: 'Data Structure and Algorithm', creditHours: '3(2-2-5)',
    groups: [
      [{ code: '30901-2001', nameTh: 'โครงสร้างข้อมูลและอัลกอริทึม', credits: '3' }],
    ],
  },
  {
    code: '5-153-231', nameTh: 'ระบบจัดการฐานข้อมูลและคลังข้อมูล', nameEn: 'Database Management Systems and Data Warehouse', creditHours: '3(0-6-3)',
    groups: [
      [{ code: '30204-2002', nameTh: 'ระบบจัดการฐานข้อมูล', credits: '3' }],
      [{ code: '30901-1003', nameTh: 'ระบบฐานข้อมูลและการออกแบบ', credits: '3' }],
      [{ code: '396-13-01', nameTh: 'ระบบจัดการฐานข้อมูล', credits: '3' }],
      [{ code: '31910-2002', nameTh: 'ระบบจัดการฐานข้อมูล', credits: '3' }],
      [{ code: '31901-2007', nameTh: 'เทคโนโลยีการจัดการฐานข้อมูล', credits: '3' }],
    ],
  },
  {
    code: '5-152-331', nameTh: 'ระบบเครือข่ายและการรักษาความปลอดภัยทางไซเบอร์สำหรับธุรกิจดิจิทัล', nameEn: '', creditHours: '3(0-6-3)',
    groups: [
      [{ code: '30204-2007', nameTh: 'เครือข่ายคอมพิวเตอร์และความปลอดภัยสำหรับธุรกิจดิจิทัล', credits: '3' }],
      [{ code: '396-24-01', nameTh: 'เครือข่ายคอมพิวเตอร์และความปลอดภัยสำหรับธุรกิจดิจิทัล', credits: '3' }],
      [{ code: '31910-2007', nameTh: 'เครือข่ายคอมพิวเตอร์และความปลอดภัย', credits: '3' }],
    ],
  },
  {
    code: '5-154-234', nameTh: 'นวัตกรรมธุรกิจยุคใหม่', nameEn: '', creditHours: '3(2-2-5)',
    groups: [
      [
        { code: '30204-2001', nameTh: 'พื้นฐานธุรกิจดิจิทัล', credits: '3' },
        { code: '30204-2004', nameTh: 'หลักการคิดเชิงออกแบบและนวัตกรรมธุรกิจดิจิทัล', credits: '3' },
      ],
      [
        { code: '396-11-04', nameTh: 'พื้นฐานธุรกิจดิจิทัล', credits: '3' },
        { code: '396-11-05', nameTh: 'หลักการคิดเชิงออกแบบและนวัตกรรมธุรกิจดิจิทัล', credits: '3' },
      ],
      [
        { code: '31910-1002', nameTh: 'ธุรกิจดิจิทัล', credits: '3' },
        { code: '31910-2004', nameTh: 'หลักการคิดเชิงออกแบบและนวัตกรรมธุรกิจดิจิทัล', credits: '3' },
      ],
    ],
  },
  {
    code: '5-154-231', nameTh: 'ดิจิทัลคอนเทนท์เพื่องานธุรกิจ', nameEn: '', creditHours: '3(0-6-3)',
    groups: [
      [
        { code: '30204-2102', nameTh: 'สื่อสร้างสรรค์ธุรกิจดิจิทัล', credits: '3' },
        { code: '30204-2006', nameTh: 'การสร้างแบรนด์ธุรกิจดิจิทัล', credits: '3' },
      ],
      [
        { code: '30204-2102', nameTh: 'สื่อสร้างสรรค์ธุรกิจดิจิทัล', credits: '3' },
        { code: '30204-2204', nameTh: 'การผลิตสื่อมัลติมีเดียสำหรับธุรกิจดิจิทัล', credits: '3' },
      ],
      [
        { code: '30204-2006', nameTh: 'การสร้างแบรนด์ธุรกิจดิจิทัล', credits: '3' },
        { code: '30204-2204', nameTh: 'การผลิตสื่อมัลติมีเดียสำหรับธุรกิจ', credits: '3' },
      ],
      [
        { code: '30204-2006', nameTh: 'การสร้างแบรนด์ธุรกิจดิจิทัล', credits: '3' },
        { code: '31910-2018', nameTh: 'การผลิตสื่อมัลติมีเดียสำหรับธุรกิจดิจิทัล', credits: '3' },
      ],
      [
        { code: '30204-2006', nameTh: 'การสร้างแบรนด์ธุรกิจดิจิทัล', credits: '3' },
        { code: '31910-2010', nameTh: 'สื่อสร้างสรรค์ธุรกิจดิจิทัล', credits: '3' },
      ],
      [
        { code: '31910-2018', nameTh: 'การผลิตสื่อมัลติมีเดียสำหรับธุรกิจ', credits: '3' },
        { code: '31910-2010', nameTh: 'สื่อสร้างสรรค์ธุรกิจดิจิทัล', credits: '3' },
      ],
      [
        { code: '31910-2006', nameTh: 'การสร้างแบรนด์ธุรกิจดิจิทัล', credits: '3' },
        { code: '31910-2010', nameTh: 'สื่อสร้างสรรค์ธุรกิจดิจิทัล', credits: '3' },
      ],
      [
        { code: '30204-2006', nameTh: 'การสร้างแบรนด์ธุรกิจดิจิทัล', credits: '3' },
        { code: '31910-2018', nameTh: 'การผลิตสื่อมัลติมีเดียสำหรับธุรกิจดิจิทัล', credits: '3' },
      ],
    ],
  },
  {
    code: '5-153-332', nameTh: 'การวิเคราะห์ข้อมูลขนาดใหญ่และวิทยาการ', nameEn: 'Big Data Analytics and Data Science', creditHours: '3(0-6-3)',
    groups: [
      [{ code: '31910-1003', nameTh: 'การวิเคราะห์ข้อมูล', credits: '3' }],
      [{ code: '31901-2012', nameTh: 'การวิเคราะห์และนำเสนอข้อมูล', credits: '3' }],
    ],
  },
  {
    code: '5-153-241', nameTh: 'การพัฒนาแอปพลิเคชัน', nameEn: '', creditHours: '3(0-6-3)',
    groups: [
      [{ code: '31910-2022', nameTh: 'การพัฒนาโปรแกรมบนอุปกรณ์เคลื่อนที่พกพา', credits: '3' }],
    ],
  },
  {
    code: '5-152-345', nameTh: 'กระบวนการพัฒนาซอฟต์แวร์', nameEn: '', creditHours: '3(3-0-6)',
    groups: [
      [{ code: '30204-2003', nameTh: 'การวิเคราะห์และออกแบบระบบเชิงวัตถุ', credits: '3' }],
      [{ code: '30901-2002', nameTh: 'การวิเคราะห์และออกแบบเชิงวัตถุ', credits: '3' }],
      [{ code: '396-22-02', nameTh: 'การวิเคราะห์และออกแบบระบบเชิงวัตถุ', credits: '3' }],
      [{ code: '31910-2003', nameTh: 'การวิเคราะห์และออกแบบระบบเชิงวัตถุ', credits: '3' }],
      [{ code: '31901-2003', nameTh: 'การวิเคราะห์และออกแบบระบบเชิงวัตถุ', credits: '3' }],
    ],
  },
  {
    code: '5-152-241', nameTh: 'การออกแบบปฏิสัมพันธ์ระหว่างมนุษย์กับสื่อดิจิทัล', nameEn: '', creditHours: '3(2-2-5)',
    groups: [
      [{ code: '30204-2401', nameTh: 'การออกแบบส่วนติดต่อผู้ใช้', credits: '3' }],
      [{ code: '30204-2301', nameTh: 'การออกแบบส่วนติดต่อผู้ใช้บนอุปกรณ์พกพา', credits: '3' }],
      [{ code: '30901-2125', nameTh: 'การออกแบบส่วนติดต่อผู้ใช้', credits: '3' }],
      [{ code: '31910-2025', nameTh: 'การออกแบบส่วนติดต่อผู้ใช้', credits: '3' }],
    ],
  },
  {
    code: '5-221-405', nameTh: 'การเป็นผู้ประกอบการธุรกิจ', nameEn: '', creditHours: '3(2-2-5)',
    groups: [
      [{ code: '30001-1001', nameTh: 'การเป็นผู้ประกอบการ', credits: '3' }],
    ],
  },
];

const TEST_USERS = [
  { username: 'teacher1', password: 'teacher1234', fullName: 'อาจารย์ทดสอบ', role: 'teacher' as const },
  { username: 'committee1', password: 'committee1234', fullName: 'ผู้ช่วยศาสตราจารย์ ดร.นิกร กรรณิกากลาง', role: 'committee' as const },
  { username: 'committee2', password: 'committee1234', fullName: 'ผู้ช่วยศาสตราจารย์วาสนา ด้วงเหมือน', role: 'committee' as const },
  { username: 'committee3', password: 'committee1234', fullName: 'ผู้ช่วยศาสตราจารย์ ดร.ณัฐรฐนนท์ กานต์รวีกุลธนา', role: 'committee' as const },
];

const TEST_STUDENTS = [
  { studentId: '106690001', fullName: 'นายสมชาย ใจดี' },
  { studentId: '106690002', fullName: 'นางสาวสมหญิง รักเรียน' },
  { studentId: '106690003', fullName: 'นายอภิชาติ ขยันเรียน' },
];

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/credit_transfer';
  await mongoose.connect(uri);
  console.log('connected to', uri);

  // 0) Faculties
  for (const f of FACULTIES) {
    const exists = await Faculty.findOne({ nameTh: f.nameTh });
    if (!exists) await Faculty.create(f);
  }
  console.log(`faculties: ${FACULTIES.length}`);

  // 1) Program
  let prog = await Program.findOne({ code: PROGRAM.code });
  if (!prog) prog = await Program.create(PROGRAM);
  console.log('program:', prog.code);

  // 2) AcademicYear
  let year = await AcademicYear.findOne({ year: YEAR, programId: prog._id });
  if (!year) year = await AcademicYear.create({ year: YEAR, programId: prog._id, level: 'เทียบโอน' });
  console.log('year:', year.year);

  // 3) UniCourses + TransferGroups (idempotent: ลบของปีนี้แล้วสร้างใหม่)
  await UniCourse.deleteMany({ yearId: year._id });
  await TransferGroup.deleteMany({});

  for (let i = 0; i < COURSES.length; i++) {
    const c = COURSES[i];
    const uc = await UniCourse.create({
      yearId: year._id, code: c.code, nameTh: c.nameTh, nameEn: c.nameEn,
      credits: 3, creditHours: c.creditHours, order: i,
    });
    for (let g = 0; g < c.groups.length; g++) {
      await TransferGroup.create({
        uniCourseId: uc._id, groupNo: g + 1, externalCourses: c.groups[g],
      });
    }
  }
  console.log(`courses: ${COURSES.length}, groups: ${COURSES.reduce((s, c) => s + c.groups.length, 0)}`);

  // 4) Users (teacher + committees)
  for (const u of TEST_USERS) {
    const exists = await User.findOne({ username: u.username });
    if (!exists) {
      const passwordHash = await bcrypt.hash(u.password, 10);
      await User.create({ username: u.username, passwordHash, fullName: u.fullName, role: u.role });
      console.log(`user: ${u.username} / ${u.password}`);
    }
  }

  // 5) Test students + their login users (default password "1234" + mustChangePassword)
  //    idempotent: ถ้ามี user อยู่แล้ว จะ reset เป็นรหัส 1234 + บังคับเปลี่ยนรหัส (สะดวกตอนทดสอบ)
  const passwordHash1234 = await bcrypt.hash('1234', 10);
  for (const s of TEST_STUDENTS) {
    let stu = await Student.findOne({ studentId: s.studentId });
    if (!stu) {
      stu = await Student.create({
        studentId: s.studentId, fullName: s.fullName,
        programId: prog._id, yearId: year._id, level: 'เทียบโอน',
      });
    }
    await User.findOneAndUpdate(
      { username: s.studentId },
      { username: s.studentId, passwordHash: passwordHash1234, fullName: s.fullName,
        role: 'student', studentId: s.studentId, mustChangePassword: true },
      { upsert: true, new: true }
    );
    console.log(`student-user: ${s.studentId} / 1234 (must change on first login)`);
  }

  console.log('\n✓ seed-data done');
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
