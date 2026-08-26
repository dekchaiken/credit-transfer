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

