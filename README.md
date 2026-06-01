# ระบบใบเทียบโอนรายวิชา (Credit Transfer)

ระบบเว็บสำหรับสร้าง/ออก **ใบเทียบโอนรายวิชา (สวท. 12-05)** แบบ PDF พร้อมปริ้น

## Stack
- Next.js 15 (App Router) + TypeScript
- TailwindCSS (minimal)
- MongoDB + Mongoose
- NextAuth (credentials)
- @react-pdf/renderer (Sarabun font)
- papaparse (CSV import)

## เริ่มใช้งาน

```bash
# 1. install
npm install

# 2. ตรวจว่า MongoDB รัน (Service "MongoDB" บน Windows)
sc query MongoDB

# 3. seed admin คนแรก  (ใช้ค่าจาก .env.local: admin / admin1234)
npm run seed

# 4. รัน dev
npm run dev
```

เปิด http://localhost:3000 → login ด้วย `admin / admin1234`

## Roles
- **admin** — จัดการ user ทุกประเภท + สาขาวิชา
- **teacher** (อาจารย์) — กรอกรายวิชา + กลุ่มเทียบ + นักศึกษา + สร้างใบเทียบ
- **committee** (กรรมการ) — สิทธิเหมือน teacher (เข้ามาทำการเทียบ)
- **student** — ดูใบเทียบของตัวเอง + เปิด PDF

## Flow
1. **admin** สร้าง user (อาจารย์/กรรมการ/นักศึกษา) + สร้างสาขาวิชา
2. **อาจารย์** สร้างปีการศึกษา → กรอกรายวิชาฝั่งมหาลัย → กรอกกลุ่มเทียบ (วิชาฝั่ง นศ.)
3. **อาจารย์** นำเข้านักศึกษาผ่าน CSV หรือเพิ่มทีละคน (ผูกปีการศึกษา)
4. **อาจารย์/กรรมการ** เปิดใบเทียบของแต่ละ นศ. → ติ๊กกลุ่ม + ใส่เกรด → บันทึก → เปิด PDF
5. **นักศึกษา** login เข้ามาดู PDF ใบเทียบของตัวเอง

## CSV format (students)

```csv
studentId,fullName,programCode,year,level
106xxx,นายสมชาย ใจดี,IT-DBT,2569,เทียบโอน
```
ระบบจะสร้าง `AcademicYear` อัตโนมัติถ้ายังไม่มี

## Path
- `src/app/login` — หน้าเข้าสู่ระบบ
- `src/app/admin/*` — admin
- `src/app/teacher/*` — อาจารย์/กรรมการ
- `src/app/student/*` — นักศึกษา
- `src/app/api/*` — REST API
- `src/components/pdf/TransferSheetPDF.tsx` — เลย์เอาต์ PDF (สวท. 12-05)
- `src/models/*` — Mongoose schemas

## Production
- เปลี่ยน `NEXTAUTH_SECRET` เป็นค่าสุ่มยาว
- ตั้ง `MONGODB_URI` ชี้ DB จริง (Atlas/local)
- `npm run build && npm start`
