# 📝 บันทึกการเปลี่ยนแปลง (Updates Log)

บันทึกการแก้ไขและปรับปรุงระบบใบเทียบโอนรายวิชา

---

## 🗓️ 2026-08-26

### ✨ ปรับปรุง UI: หน้า Admin Users

**ไฟล์ที่แก้ไข:**
- `src/app/admin/users/page.tsx` (บรรทัด 132-144)

**รายละเอียด:**
- ออกแบบส่วน "คำแนะนำ" ใหม่ให้ทันสมัยและอ่านง่ายขึ้น
- เปลี่ยนจากรูปแบบ bullet list เป็น card-based layout
- แบ่งคำแนะนำออกเป็น 3 การ์ดย่อย:
  - 🔍 ดูรายชื่อ - คลิกการ์ดเพื่อดูผู้ใช้แต่ละ Role
  - ⚙️ จัดการผู้ใช้ - เพิ่ม แก้ไข ลบ และรีเซ็ตรหัสผ่าน
  - 📊 ข้อมูลเพิ่มเติม - Student แสดงคณะ สาขา และปีการศึกษา

**การออกแบบ:**
- ใช้ gradient background (from-brand-50/50 to-transparent)
- เพิ่ม border-l-4 สีฟ้าเพื่อให้โดดเด่น
- แต่ละการ์ดมี icon, หัวข้อ และคำอธิบาย
- รองรับ responsive (1 column บนมือถือ, 3 columns บน desktop)

**ผลลัพธ์:**
- UI สวยงามและอ่านง่ายขึ้น
- จัดกลุ่มข้อมูลชัดเจนขึ้น
- ใช้สีและ spacing ที่สอดคล้องกับ design system

---

### ✨ ฟีเจอร์ใหม่: ดึงรายวิชาจากปีก่อนหน้า

**ไฟล์ที่สร้างใหม่:**
- `src/app/api/uni-courses/copy-from-year/route.ts` - API endpoint สำหรับคัดลอกรายวิชา
- `src/components/CopyCoursesModal.tsx` - Modal component สำหรับเลือกปีต้นทาง

**ไฟล์ที่แก้ไข:**
- `src/app/teacher/uni-courses/page.tsx` (บรรทัด 1-8, 110-111, 298-305, 349-359, 657-672)

**รายละเอียด:**
**ปัญหา:** เมื่อเริ่มปีการศึกษาใหม่ (เช่น 2570) ต้องเพิ่มรายวิชาใหม่ทั้งหมดทีละตัว ซ้ำซ้อนและเสียเวลา

**โซลูชัน:** เพิ่มปุ่ม "📥 ดึงรายวิชา" ที่คัดลอกรายวิชาจากปีเก่ามาใช้ในปีใหม่

**การทำงาน:**
1. เปิด modal เลือกปีต้นทาง (เช่น 2569)
2. แสดงจำนวนรายวิชาในปีนั้น
3. กดปุ่ม "คัดลอกรายวิชา"
4. ระบบคัดลอก `CourseOffering` ทั้งหมดมาปีปัจจุบัน
5. ข้ามรายวิชาที่มีอยู่แล้ว (ไม่ซ้ำ)
6. แสดงผลลัพธ์: จำนวนที่คัดลอก + จำนวนที่ข้าม

**API Endpoint:**
```
POST /api/uni-courses/copy-from-year
Body: {
  fromYearId: string,
  toYearId: string,
  programId?: string (optional)
}
Response: {
  copiedCount: number,
  skippedCount: number,
  totalInSource: number
}
```

**Logic:**
- คัดลอกเฉพาะ `CourseOffering` (uniCourseId + yearId mapping)
- `UniCourse` (catalog กลาง) ไม่ถูกคัดลอก (ใช้ร่วมกัน)
- `TransferGroup` ไม่ถูกคัดลอก (shared across years)
- ตรวจสอบซ้ำก่อนเพิ่ม (เช็คว่ามี uniCourseId ในปีปลายทางแล้วหรือยัง)
- Invalidate years cache หลังคัดลอกสำเร็จ

**UI/UX:**
- Modal แสดง dropdown ปีต้นทาง (กรองเฉพาะปีอื่นที่ไม่ใช่ปีปัจจุบัน)
- Real-time course count เมื่อเลือกปี
- Loading state ระหว่างคัดลอก
- Error handling และ validation
- Toast notification เมื่อสำเร็จ

**Authorization:**
- เฉพาะ `admin` และ `committee` เท่านั้น (teacher เป็น read-only)

**ผลลัพธ์:**
- ประหยัดเวลาในการเริ่มต้นปีใหม่
- ลดความผิดพลาดจากการพิมพ์ซ้ำ
- รักษาความสอดคล้องของข้อมูล

---

### 🔓 UI Improvement: ปุ่มดึงรายวิชาแสดงทุก Role

**ไฟล์ที่แก้ไข:**
- `src/app/teacher/uni-courses/page.tsx` (บรรทัด 353-370)

**รายละเอียด:**
- แยกปุ่ม "📥 ดึงรายวิชา" ออกจากส่วน committee/admin only
- สร้าง section แยกต่างหากสำหรับปุ่มดึงรายวิชา
- ทำให้ **Teacher, Committee, และ Admin ใช้งานได้ทุก role**
- ฟอร์ม "➕ เพิ่มรายวิชาใหม่" ยังคงเป็น committee/admin only

**เหตุผล:**
- Teacher ต้องการดึงรายวิชาจากปีเก่ามาใช้ (read-only operation)
- การดึงข้อมูลไม่ใช่การแก้ไข ไม่ขัดกับ read-only role
- ลดขั้นตอนในการทำงานของ teacher

**UI ใหม่:**
```
┌──────────────────────────────────┐
│ 📥 ดึงรายวิชาจากปีอื่น         │
│                  [📥 ดึงรายวิชา] │ ← ทุก role เห็น
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ ➕ เพิ่มรายวิชาใหม่            │
│                      [+ ฟอร์ม]   │ ← เฉพาะ committee/admin
└──────────────────────────────────┘
```

---

### ✨ ฟีเจอร์ใหม่: คัดลอกทั้งปีการศึกษา (Copy Entire Year)

**ไฟล์ที่สร้างใหม่:**
- `src/app/api/years/copy-entire-year/route.ts` - API endpoint สำหรับคัดลอกทั้งปี
- `src/components/CopyEntireYearModal.tsx` - Modal component สำหรับเลือกปีต้นทาง

**ไฟล์ที่แก้ไข:**
- `src/app/teacher/uni-courses/page.tsx` (บรรทัด 1-9, 112-115, 303-309, 337-373, 675-685)

**รายละเอียด:**
**ปัญหา:** เมื่อเริ่มปีใหม่ (เช่น 2570) ไม่มีสาขาเลย ต้องไปสร้างสาขาที่หน้า "จัดการปีการศึกษา" ก่อน แล้วค่อยกลับมาดึงรายวิชา → ใช้เวลานาน 2 ขั้นตอน

**โซลูชัน:** คัดลอกทั้งปี (สาขา + รายวิชา) ในคลิกเดียว

**การทำงาน:**
1. เข้าหน้า `/teacher/uni-courses?year=2570` (ปีที่ยังไม่มีสาขา)
2. ระบบตรวจสอบ: ถ้าไม่มีสาขาเลย → แสดงหน้าว่าง + ปุ่ม "📥 คัดลอกทั้งปีจากปีอื่น"
3. กดปุ่ม → เปิด modal เลือกปีต้นทาง (เช่น 2569)
4. กด "คัดลอกทั้งปี" → ระบบทำงาน:
   - คัดลอก `AcademicYear` ทั้งหมดจากปี 2569 → สร้างเป็นปี 2570
   - คัดลอก `CourseOffering` ของแต่ละสาขา → map ไปยัง yearId ใหม่
   - Invalidate years cache
5. แสดงผลลัพธ์: จำนวนสาขา + จำนวนรายวิชา + รายการสาขาที่คัดลอก
6. Reload หน้า → เห็นสาขาทั้งหมดพร้อมรายวิชา

**API Endpoint:**
```
POST /api/years/copy-entire-year
Body: {
  fromYear: number,  // ปีต้นทาง เช่น 2569
  toYear: number     // ปีปลายทาง เช่น 2570
}
Response: {
  copiedPrograms: number,
  copiedCourses: number,
  details: [{ program: string, level: string }]
}
```

**Logic:**
1. ตรวจสอบว่าปีปลายทางว่างเปล่า (ไม่มี AcademicYear) → ถ้ามีแล้ว ปฏิเสธ
2. หา `AcademicYear` ทั้งหมดของปีต้นทาง (populate programId)
3. สร้าง `AcademicYear` ใหม่สำหรับปีปลายทาง (เปลี่ยนเฉพาะ year, เก็บ programId + level เดิม)
4. สร้าง mapping: `sourceYearId → newYearId`
5. หา `CourseOffering` ของแต่ละ sourceYearId
6. สร้าง `CourseOffering` ใหม่ → map uniCourseId + newYearId + order
7. Insert ทั้งหมด

**UI/UX:**
- **Empty state** เมื่อไม่มีสาขา:
  - ไอคอน 📚 ขนาดใหญ่
  - หัวข้อ: "ยังไม่มีสาขาในปี XXXX"
  - คำอธิบาย: "คัดลอกสาขาและรายวิชาทั้งหมดจากปีอื่นมาใช้ในปีนี้"
  - ปุ่มใหญ่: "📥 คัดลอกทั้งปีจากปีอื่น"
  - Link ทางเลือก: "หรือไปที่ จัดการปีการศึกษา เพื่อเพิ่มสาขาใหม่"

- **Modal:**
  - Dropdown เลือกปีต้นทาง (เรียงจากมากไปน้อย)
  - Warning box: อธิบายว่าจะคัดลอกอะไรบ้าง
  - Success box: แสดงผลลัพธ์พร้อมรายละเอียดสาขา
  - Auto-close หลังสำเร็จ 2 วินาที → reload หน้า

**Validation:**
- ปีต้นทางต้องมีข้อมูล (มี AcademicYear)
- ปีปลายทางต้องว่างเปล่า (ไม่มี AcademicYear)
- ไม่สามารถคัดลอกภายในปีเดียวกันได้

**Authorization:**
- เฉพาะ `admin` และ `committee` (API level)
- UI แสดงทุก role (รวม teacher) แต่ API จะ block teacher

**TransferGroup:**
- ไม่ถูกคัดลอก (shared across years ตาม architecture)
- กลุ่มเทียบยังคงใช้ร่วมกันระหว่างปี

**ผลลัพธ์:**
- ลดเวลาเริ่มต้นปีใหม่จาก 2 ขั้นตอน → 1 ขั้นตอน
- คัดลอกได้ครบทุกสาขาในคลิกเดียว
- ข้อมูลสอดคล้อง (ใช้ programId เดียวกัน)
- ไม่ต้องสร้างสาขาทีละตัว

**Use Case:**
- เริ่มปีการศึกษาใหม่ 2570 → คัดลอกจาก 2569
- ทดสอบระบบในปีใหม่ → คัดลอกจากปีจริง
- Backup/Restore → คัดลอกข้อมูลย้อนหลัง

---

### 🎯 UI Improvement: เลือกสาขาที่ต้องการคัดลอกได้

**ไฟล์ที่แก้ไข:**
- `src/components/CopyEntireYearModal.tsx` (ปรับปรุงทั้งไฟล์)
- `src/app/api/years/copy-entire-year/route.ts` (บรรทัด 13-35)

**รายละเอียด:**
**ปัญหา:** Modal เดิมคัดลอกสาขาทั้งหมดโดยอัตโนมัติ ไม่สามารถเลือกได้

**โซลูชัน:** เพิ่ม checkbox list ให้เลือกสาขาที่ต้องการคัดลอก

**การทำงานใหม่:**
1. เลือกปีต้นทาง (เช่น 2569)
2. ระบบโหลดรายการสาขาในปีนั้น (auto-populate + checkbox list)
3. **เลือกสาขาที่ต้องการ** (ติ๊กได้/ไม่ติ๊ก, ปุ่มเลือก/ยกเลิกทั้งหมด)
4. กดคัดลอก → ส่ง `programIds` (array of yearId) ไปที่ API
5. API คัดลอกเฉพาะสาขาที่เลือก

**UI Components:**
- **Checkbox list:** แสดงรายการสาขาพร้อม programId.nameTh + level
- **Toggle all button:** เลือก/ยกเลิกทั้งหมดในคลิกเดียว
- **Counter:** "เลือกแล้ว: X จาก Y สาขา"
- **Validation:** ต้องเลือกอย่างน้อย 1 สาขา
- **Button text:** เปลี่ยนจาก "คัดลอกทั้งปี" → "คัดลอก X สาขา" (dynamic)

**API Changes:**
- เพิ่ม parameter: `programIds: string[]` (array of AcademicYear._id)
- Query เปลี่ยนจาก `{ year: fromYear }` → `{ _id: { $in: programIds }, year: fromYear }`
- Validation: ตรวจสอบว่า programIds ไม่ว่าง

**UX Improvements:**
- Default: เลือกทั้งหมดตั้งแต่แรก (สะดวกสำหรับกรณี copy all)
- Scrollable list: max-height 256px เมื่อมีสาขาเยอะ
- Loading state: แสดง "กำลังโหลด..." ขณะ fetch programs
- Empty state: ถ้าปีต้นทางไม่มีสาขา

**ผลลัพธ์:**
- เลือกคัดลอกได้เฉพาะสาขาที่ต้องการ
- ลดขนาดข้อมูลที่คัดลอก (กรณีไม่ต้องการทุกสาขา)
- UI ชัดเจนขึ้น เห็นรายละเอียดก่อนคัดลอก

---

### ✨ ฟีเจอร์: ดึงสาขาเพิ่ม + ลบสาขา

**ไฟล์ที่สร้างใหม่:**
- `src/app/api/years/delete-program/route.ts` - API endpoint สำหรับลบสาขา

**ไฟล์ที่แก้ไข:**
- `src/app/api/years/copy-entire-year/route.ts` (บรรทัด 48-78, 81-86, 110-117)
- `src/app/teacher/uni-courses/page.tsx` (บรรทัด 312-328, 335-347)
- `src/components/CopyEntireYearModal.tsx` (เพิ่มแสดง skippedPrograms)

**รายละเอียด:**

#### 1️⃣ ดึงสาขาเพิ่มได้ (ไม่บล็อกเมื่อปีมีข้อมูลแล้ว)

**ปัญหาเดิม:** 
- ปี 2570 มีสาขา IT อยู่แล้ว
- ดึงจาก 2569 (มี IT, DBT, SE) → API ปฏิเสธ "ปี 2570 มีข้อมูลอยู่แล้ว"
- ต้องลบทั้งปี → ดึงใหม่ทั้งหมด

**โซลูชัน:**
- ตรวจสอบสาขาที่มีอยู่แล้วใน target year
- กรองเฉพาะสาขาใหม่ที่ยังไม่มี (filter by programId)
- คัดลอกเฉพาะสาขาใหม่ ข้ามสาขาที่ซ้ำ
- แสดงผลลัพธ์: copiedPrograms + skippedPrograms

**ตัวอย่าง:**
```
ปี 2570 มีอยู่: IT
ดึงจาก 2569: IT, DBT, SE
→ ข้าม: IT (1 สาขา)
→ คัดลอก: DBT, SE (2 สาขา)
→ ผลลัพธ์ปี 2570: IT, DBT, SE
```

**API Changes:**
- ลบการเช็ค "ปีปลายทางต้องว่างเปล่า"
- เพิ่มการ filter duplicate programs
- Return `skippedPrograms` count

#### 2️⃣ ลบสาขา (พร้อมรายวิชา)

**ตำแหน่ง:** หน้า `/teacher/uni-courses` เมื่อเลือกสาขาแล้ว

**UI:**
```
[รายวิชาของสาขา]  [วิชา: 25]  [🗑️ ลบสาขา]  [🔄 เปลี่ยนปี]
```

**การทำงาน:**
1. กดปุ่ม "🗑️ ลบสาขา"
2. Confirm dialog: "ลบสาขา [ชื่อ]? จะลบสาขาและรายวิชาทั้งหมดในปี XXXX"
3. ยืนยัน → DELETE `/api/years/delete-program?yearId=xxx`
4. API ลบ:
   - `CourseOffering` ทั้งหมดของ yearId นั้น
   - `AcademicYear` record
   - Invalidate years cache
5. แสดง toast: "ลบสาขา [ชื่อ] แล้ว (X วิชา)"
6. Reload หน้า

**API Endpoint:**
```
DELETE /api/years/delete-program?yearId=<id>
Response: {
  deletedProgram: string,
  deletedCourses: number
}
```

**Authorization:**
- เฉพาะ `admin` และ `committee`
- ปุ่มไม่แสดงเมื่อ `isReadOnly` (teacher)

**Safety:**
- ลบเฉพาะสาขาที่เลือก (yearId specific)
- ไม่กระทบปีอื่น (query by yearId only)
- Cascade delete CourseOffering → ไม่เหลือ orphan records
- Confirm dialog ป้องกันการลบโดยไม่ตั้งใจ

**ผลลัพธ์:**
- สามารถดึงสาขาเพิ่มได้เรื่อยๆ ไม่ต้องลบทิ้งแล้วเริ่มใหม่
- ลบสาขาที่ไม่ต้องการได้ทันที
- จัดการสาขาใน production ได้ยืดหยุ่นขึ้น

**Use Cases:**
- เพิ่มสาขาใหม่ในปีที่มีข้อมูลอยู่แล้ว
- ลบสาขาที่เปิดไม่ถึง
- ปรับแก้ข้อมูลโดยไม่ต้อง reset ทั้งปี

---

