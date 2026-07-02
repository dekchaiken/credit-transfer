# 📋 TASKS — Credit Transfer System

> อัปเดตล่าสุด: 2026-07-02
> สถานะ: ⬜ ยังไม่ทำ | 🔄 กำลังทำ | ✅ เสร็จแล้ว | ❓ รอ clarify

---

## รอบนี้ (2026-07-02)

### ✅ เสร็จแล้ว

- **[DONE] ปุ่มลบปีการศึกษาใน YearPickerModal**
  - เพิ่มปุ่ม 🗑 บนการ์ดแต่ละปีในหน้า admin
  - API: `DELETE /api/years?yearNum=N` (cascade CourseOffering + AcademicYear + Year doc)
  - Commit: `03a1dc3`, `eafb676`

---

## งานใหม่ 8 ข้อ

| # | หัวข้อ | สถานะ | ความยาก |
|---|---|---|---|
| 1 | Login ด้วย email ของนักศึกษาไม่ได้ | ✅ | 🟢 ง่าย |
| 2 | Password requirement เข้มขึ้น (6 ตัว + special + upper/lower) | ✅ | 🟢 ง่าย |
| 2b | ข้อความ "สาขาซ้ำ" ใน bulk-create ปี | ✅ | 🟢 ง่ายมาก |
| 3 | ปุ่ม "ยกเลิก" → พื้นแดง ตัวขาว | ⬜ | 🟡 ปานกลาง |
| 4 | Bug นักศึกษา — ชื่อซ้ำทั้งที่ studentId ต่างกัน | ⬜ | 🟡 ต้องสืบก่อน |
| 5 | เพิ่มข้อความ "(ใบเทียบรายวิชา ปีการศึกษา XXXX)" หน้าปี | ⬜ | 🟢 ง่าย |
| 6 | ตัดฟีเจอร์คณะออก | ⬜ | 🟡 ปานกลาง |
| 7 | ปุ่ม "ลืมรหัสผ่าน" ใน login page → popup | ⬜ | 🟢 ง่าย |
| 8 | สลับสิทธิ์ teacher ↔ committee | ❓ | 🔴 ซับซ้อน |

---

## รายละเอียดแต่ละข้อ

---

### 1 — Login ด้วย email ⬜

**ปัญหา:** นักศึกษาพิมพ์ email เข้าสู่ระบบแล้วเข้าไม่ได้  
**สาเหตุ:** `authOptions.ts` query แค่ `User.findOne({ username })` ไม่มี fallback email  
**แก้:** เพิ่ม fallback — ถ้า `username` ไม่เจอ ให้ query `{ email: credentials.username }` ด้วย  
**ไฟล์:** `src/lib/authOptions.ts`

---

### 2 — Password requirement ⬜

**ต้องการ:**
- อย่างน้อย 6 ตัวอักษร
- มีตัวพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว
- มีตัวพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว
- มีอักขระพิเศษ (!@#$%^&* ฯลฯ) อย่างน้อย 1 ตัว
- แสดง popup/error message ถ้าไม่ผ่าน  

**ไฟล์:** `src/app/change-password/page.tsx`  
**หมายเหตุ:** ควร validate ฝั่ง backend ด้วย (`src/app/api/users/me/password/route.ts`)

---

### 2b — ข้อความสาขาซ้ำ ⬜

**เดิม:** "สาขานี้มีอยู่ในปีนี้แล้ว"  
**เปลี่ยนเป็น:** "มีสาขาซ้ำในระบบ จะทำการข้ามสาขาที่มีอยู่แล้ว"  
**ไฟล์:** `src/app/admin/years/new/page.tsx`

---

### 3 — ปุ่มยกเลิก ⬜

**แก้:** ปุ่ม "ยกเลิก" ทั่วระบบ → `bg-red-600 text-white hover:bg-red-700`  
**แนวทาง:** เพิ่ม `.btn-cancel` class ใน `src/app/globals.css` แล้วใส่ให้ทุกปุ่มยกเลิก  
**ไฟล์หลัก:** `src/app/globals.css` + หลายหน้า (ConfirmDialog, modals, forms)

---

### 4 — Bug นักศึกษา ⬜

**อาการ:** เพิ่มนักศึกษาใหม่ (รหัสไม่ซ้ำ แต่ชื่อซ้ำ) ระบบแจ้งว่าซ้ำ  
**ต้องสืบ:** อาจมี unique index บน `fullName` ใน MongoDB หรือ error message แสดงผิด  
**ไฟล์:** `src/app/api/students/route.ts`, `src/models/Student.ts`

---

### 5 — ข้อความหน้าปี ⬜

**เดิม:** "ปี 2569"  
**เปลี่ยนเป็น:** "(ใบเทียบรายวิชา ปีการศึกษา 2569)"  
**ไฟล์:** `src/components/NavYearSelector.tsx` (และที่อื่นที่แสดงปี)

---

### 6 — ตัดฟีเจอร์คณะ ⬜

**ไฟล์ที่ลบ/ซ่อน:**
- `src/app/admin/faculties/page.tsx`
- `src/app/teacher/faculties/page.tsx`
- `src/app/api/faculties/route.ts`
- `src/app/api/faculties/[id]/route.ts`
- ลิงก์ใน Sidebar (`src/app/admin/layout.tsx`, `src/app/teacher/layout.tsx`)

**ระวัง:** field `faculty` ยังใช้อยู่ใน `Program` model และ PDF — ไม่ได้ลบ data แค่ซ่อน UI

---

### 7 — ลืมรหัสผ่าน popup ⬜

**แก้:** เพิ่มปุ่ม "ลืมรหัสผ่าน?" ใน login page  
**Popup แสดง:** "หากท่านลืมรหัสผ่าน โปรดติดต่อผู้ดูแลระบบ, อาจารย์, และผู้ที่เกี่ยวข้องฯ"  
**ไฟล์:** `src/app/login/page.tsx`

---

### 8 — สลับสิทธิ์ teacher ↔ committee ❓

**รอ clarify:** ยังไม่ชัดเจนว่าต้องการแบบไหน

- **แบบ A:** สลับชื่อ role ใน DB (`teacher` → `committee` และกลับกัน) — กระทบทุกที่ที่ใช้ string role
- **แบบ B:** คงชื่อ role แต่เปลี่ยน permission ใน middleware/API ให้ `committee` จัดการได้ `teacher` ดูได้อย่างเดียว

**ไฟล์หลักที่กระทบ (แบบ B):**
- `src/middleware.ts`
- `src/lib/auth.ts`
- API routes ที่มี `requireRole(['teacher', ...])` ประมาณ 10+ ไฟล์

---

## Deploy Log

| วันที่ | Commit | รายละเอียด | สถานะ |
|---|---|---|---|
| 2026-07-02 | `03a1dc3` | feat: ปุ่มลบปีใน YearPickerModal | ✅ deployed |
| 2026-07-02 | `eafb676` | fix: AuditAction type (year.delete_all) | ✅ deployed |
