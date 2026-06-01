# คู่มือใช้งาน — ระบบใบเทียบโอนรายวิชา

## 0. ข้อมูล server (ตอนนี้รันอยู่)

| ส่วน | ค่า |
|---|---|
| URL | http://localhost:3000 |
| MongoDB | `mongodb://127.0.0.1:27017/credit_transfer` (service "MongoDB" รันอัตโนมัติ) |
| Project path | `C:\Users\iiken\OneDrive\เอกสาร\Dev\credit-transfer` |

---

## 1. การติดตั้งใหม่ (ถ้าย้ายเครื่อง)

```bash
# ติดตั้ง Python (ใช้ครั้งเดียวสำหรับ extract PDF — ข้ามได้ถ้าไม่ต้องใช้)
winget install -e --id Python.Python.3.12

# ติดตั้ง MongoDB
winget install -e --id MongoDB.Server

# ติดตั้ง dependencies
cd "C:\Users\iiken\OneDrive\เอกสาร\Dev\credit-transfer"
npm install

# seed admin (admin / admin1234)
npm run seed

# seed ข้อมูลทดสอบทั้งหมด (สาขา + ปี 2569 + 14 รายวิชา + 60 กลุ่มเทียบ + user ทดสอบ)
npm run seed:data

# รัน
npm run dev
```

---

## 2. บัญชีทดสอบ (มีอยู่แล้วในระบบหลัง `seed:data`)

| Role | Username | Password | สิทธิ์ |
|---|---|---|---|
| **admin** | `admin` | `admin1234` | จัดการ user + คณะ + สาขา |
| **teacher** | `teacher1` | `teacher1234` | กรอกรายวิชา + กลุ่มเทียบ + นักศึกษา + สร้างใบเทียบ |
| **committee** | `committee1` | `committee1234` | (นิกร) — สิทธิเหมือน teacher |
| **committee** | `committee2` | `committee1234` | (วาสนา) |
| **committee** | `committee3` | `committee1234` | (ณัฐรฐนนท์) |
| **student** | `106690001` | `1234` ⚠️ บังคับเปลี่ยนรหัสครั้งแรก | นายสมชาย ใจดี |
| **student** | `106690002` | `1234` ⚠️ | นางสาวสมหญิง รักเรียน |
| **student** | `106690003` | `1234` ⚠️ | นายอภิชาติ ขยันเรียน |

> **กฎใหม่ของ student**: นักศึกษาทุกคน (รวมที่ import จาก CSV) → username = รหัส นศ., password = `1234`, login ครั้งแรก ระบบจะบังคับให้เปลี่ยนรหัสก่อนใช้งาน

---

## 3. ข้อมูลที่มีอยู่แล้วในระบบ (จาก PDF จริง สวท. 12-05 ปี 2569)

| รายการ | จำนวน |
|---|---|
| **คณะ** (RMUTK) | 7 (บริหารธุรกิจ, วิทยาศาสตร์ฯ, วิศวกรรมฯ, ครุศาสตร์อุตฯ, ศิลปศาสตร์, สิ่งทอฯ, คหกรรมฯ) |
| สาขาวิชา | 1 (`IT-DBT` · เทคโนโลยีสารสนเทศและธุรกิจดิจิทัล · คณะบริหารธุรกิจ) |
| ปีการศึกษา | 1 (2569) |
| รายวิชาฝั่งมหาลัย | 14 (ตรงตาม PDF เป๊ะ) |
| กลุ่มเทียบรวม | 60 พร้อมรหัสวิชา/ชื่อ/หน่วยกิตฝั่งนักศึกษาภายในกลุ่ม |
| นักศึกษาทดสอบ | 3 (พร้อม user account) |

> ✅ **คณะ/สาขา/รายวิชา/กลุ่มเทียบ** เพิ่มเองได้ทีหลังที่หน้า admin / teacher

---

## 4. Test Scenario — ทดสอบครบทั้ง 3 user

เปิด http://localhost:3000 แล้วทำตามลำดับ:

### Test 1 · Admin (สร้าง user ใหม่)
1. Login `admin / admin1234`
2. ระบบพาไป `/admin/users`
3. เพิ่ม user เพิ่มเติมได้ (เช่น teacher2, นักศึกษาใหม่)
4. ไป `/admin/programs` → ตรวจว่ามีสาขา `IT-DBT` อยู่ ✓
5. กดปุ่ม **ออก** มุมขวาบน

### Test 2 · Teacher (ตัวเอกของระบบ — สร้างใบเทียบจริง)
1. Login `teacher1 / teacher1234` → พาไป `/teacher/years`
2. **`/teacher/years`** — ตรวจว่ามีปี **2569** อยู่ ✓
3. **`/teacher/uni-courses`** — เลือกปี 2569 จะเห็นรายวิชาฝั่งมหาลัย 14 วิชา (5-155-302, 5-151-121, ฯลฯ) ✓
4. **`/teacher/transfer-groups`** — เลือกวิชา → จะเห็นกลุ่มเทียบของวิชานั้น (เช่น "การฝึกงาน" มี 12 กลุ่ม)
   - ทดลองเพิ่มกลุ่มใหม่ได้ตรงนี้
5. **`/teacher/students`** — เห็น 3 นักศึกษาตัวอย่าง
   - ทดสอบ **import CSV**: คลิก *Choose file* → ใช้ `sample-data/students-sample.csv` (เพิ่มอีก 5 คน)
   - ทดสอบ **เพิ่มทีละคน**: กรอกฟอร์มด้านบน
6. ที่ row นักศึกษา `106690001` → กดปุ่ม **ใบเทียบ**
7. หน้า `/teacher/sheets/[id]`:
   - แต่ละ row ของรายวิชามหาลัย → dropdown "กลุ่มเทียบที่เลือก" → เลือกกลุ่มที่ผ่าน
   - ใส่ **เกรด** (เช่น A / 4.00 / 3.5)
   - ติ๊ก **นอกระบบ CE** ถ้ามี
   - ส่วน **กรรมการ 3 ท่าน** pre-fill ตาม PDF จริงให้แล้ว แก้ไขได้
   - ใส่ **เดือน/ปีลงนาม** เช่น `เมษายน 2569`
   - กด **บันทึก**
   - กด **เปิด PDF / ปริ้น** → PDF จะเปิดในแท็บใหม่
8. ในแท็บ PDF → กด `Ctrl+P` เพื่อปริ้น
9. กลับไป `/teacher/sheets` — เห็นรายการใบเทียบที่สร้าง

### Test 3 · Committee (กรรมการ — สิทธิเหมือน teacher)
1. Logout → Login `committee1 / committee1234`
2. ใช้งานได้เหมือน teacher ทุกประการ (เข้ามาตรวจ/แก้ใบเทียบ/finalize)

### Test 4 · Student (ดูผล)
1. Logout → Login `106690001 / student1234`
2. ระบบพาไป `/student` — เห็นใบเทียบของตัวเองที่ teacher สร้างไว้
3. กด **เปิด PDF** → เปิด PDF ของตัวเอง
4. **ทดสอบ permission**: ลองยิง URL ของใบเทียบคนอื่น `/api/sheets/<id>/pdf` → ระบบควร block

---

## 5. รูปแบบ CSV นำเข้านักศึกษา

ไฟล์ตัวอย่าง: `sample-data/students-sample.csv`

```csv
studentId,fullName,programCode
106690010,นายธนา ทดสอบ,IT-DBT
```

| คอลัมน์ | บังคับ | ตัวอย่าง | หมายเหตุ |
|---|---|---|---|
| `studentId` | ✓ | 106690001 | unique — ซ้ำจะถูกข้าม |
| `fullName` | ✓ | นายสมชาย ใจดี | |
| `programCode` | ✓ | IT-DBT | ต้องสร้าง Program ก่อน |

> **ปีการศึกษา + ระดับ** ดึงจาก **ปีที่เลือกบนสุดของหน้า** อัตโนมัติ — ไม่ต้องใส่ใน CSV
> User account ของ นศ. ถูกสร้างให้อัตโนมัติ: username = รหัส นศ., password = `1234` (บังคับเปลี่ยนรหัสครั้งแรก)

---

## 6. โครงสร้างเมนูทั้งหมด

```
/login                              — ทุก role
/admin/users                        — admin
/admin/programs                     — admin
/teacher/years                      — teacher, committee
/teacher/uni-courses                — teacher, committee
/teacher/transfer-groups            — teacher, committee
/teacher/students                   — teacher, committee
/teacher/sheets                     — teacher, committee (รายการใบเทียบ)
/teacher/sheets/[studentId]         — teacher, committee (แก้ไขใบเทียบ)
/student                            — student (ดู PDF ของตัวเอง)
/api/sheets/[id]/pdf                — เปิด/ดาวน์โหลด PDF
```

---

## 7. การ Reset ข้อมูล (ตอนพัฒนา)

```bash
# ลบ DB ทั้งหมด
mongosh credit_transfer --eval "db.dropDatabase()"

# seed ใหม่
npm run seed
npm run seed:data
```

หรือลบเฉพาะ collection:
```bash
mongosh credit_transfer --eval "db.transfersheets.deleteMany({})"
```

---

## 8. การขึ้น Production (เมื่อพร้อม host)

1. **`.env.production`** — ตั้งค่า:
   ```
   MONGODB_URI=mongodb+srv://...   # หรือ MongoDB Atlas
   NEXTAUTH_SECRET=<random 32+ chars>
   NEXTAUTH_URL=https://yourdomain.com
   ```
2. ```bash
   npm run build
   npm start                    # หรือ pm2 / docker
   ```
3. เปลี่ยน password admin หลัง deploy ทันที (ผ่าน DB หรือสร้างหน้า change password เพิ่ม)

---

## 9. Trouble shooting

| ปัญหา | แก้ |
|---|---|
| Login ไม่ผ่าน | ตรวจ MongoDB service: `sc query MongoDB` ต้อง RUNNING |
| PDF ฟอนต์ผิด | ระบบโหลด Sarabun จาก Google Fonts ตรวจ internet ตอน render |
| Port 3000 ใช้อยู่ | `npx kill-port 3000` หรือ `npm run dev -- -p 3001` |
| รายวิชาไม่ขึ้น | ใน `/teacher/uni-courses` เลือกปีให้ถูก |
| CSV import error | ตรวจ encoding ต้องเป็น UTF-8, หัวคอลัมน์ตรงเป๊ะ |

---

## 10. ไฟล์สำคัญสำหรับแก้ไข

| ต้องการ | ไฟล์ |
|---|---|
| ปรับเลย์เอาต์ PDF | `src/components/pdf/TransferSheetPDF.tsx` |
| เพิ่ม role | `src/middleware.ts` + `src/lib/auth.ts` |
| เปลี่ยนสี/ฟอนต์ UI | `src/app/globals.css` + `tailwind.config.ts` |
| เพิ่มฟิลด์ใน DB | `src/models/*.ts` |
| API route | `src/app/api/**/route.ts` |
| ข้อมูล seed รายวิชาปีอื่น | copy `scripts/seed-data.ts` แล้วเปลี่ยน `YEAR` + `COURSES` |
