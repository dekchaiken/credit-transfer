# 📝 CHANGELOG — Credit Transfer System

> บันทึกการแก้ไขระบบ เรียงตามลำดับที่ทำ

---

## 2026-07-02

---

### ✅ ปุ่มลบปีการศึกษาใน YearPickerModal
**Commit:** `03a1dc3`, `eafb676`

**แก้ไขอะไร:**
- เพิ่มปุ่ม 🗑 บนการ์ดแต่ละปีใน popup เลือกปี (admin เท่านั้น)
- กดแล้วจะมี confirm dialog ก่อนลบ
- ลบแล้ว cascade ลบ `CourseOffering` + `AcademicYear` + standalone `Year` ด้วย
- ถ้าลบปีที่กำลังใช้งานอยู่ → ล้าง URL param แล้วเปิด picker ให้เลือกใหม่

**ไฟล์:**
- `src/components/YearPickerModal.tsx` — เพิ่ม prop `onDeleteYear`
- `src/app/api/years/route.ts` — เพิ่ม `DELETE /api/years?yearNum=N`
- `src/app/admin/years/page.tsx` — wire ปุ่มลบเข้า modal
- `src/lib/audit.ts` — เพิ่ม `'year.delete_all'` ใน AuditAction type

---

### ✅ 1. Login ด้วย Email ของนักศึกษา
**Commit:** `a03d92b`

**ปัญหาเดิม:**
นักศึกษาพิมพ์ email เช่น `63010001@student.rmutk.ac.th` ลงในช่อง username แล้วเข้าไม่ได้ เพราะระบบ query หาแค่ `username` ตรงๆ ไม่มี fallback

**แก้อย่างไร:**
```
ถ้า input มี @ → ตัดเฉพาะส่วนหน้า @ มาใช้เป็น username
63010001@student.rmutk.ac.th → ใช้ "63010001" ในการค้นหา
```

**ไม่ต้องแตะ Database เลย** — แค่ปรับ logic ใน authOptions

**ไฟล์:** `src/lib/authOptions.ts`

---

### ✅ 2. Password Requirement เข้มขึ้น + UI Checklist
**Commit:** `c8e1775`

**ก่อนแก้:** รหัสผ่านต้องมีแค่ 4 ตัวขึ้นไป (frontend บอก 4, backend ต้องการ 8 — ไม่ตรงกัน!)

**หลังแก้:** กฎใหม่ต้องครบ 4 ข้อ:
- อย่างน้อย **6 ตัวอักษร**
- มี **ตัวพิมพ์ใหญ่** (A-Z) อย่างน้อย 1 ตัว
- มี **ตัวพิมพ์เล็ก** (a-z) อย่างน้อย 1 ตัว
- มี **อักขระพิเศษ** (!@#$% ฯลฯ) อย่างน้อย 1 ตัว

**UI ใหม่บนหน้า change-password:**
- แสดง checklist 4 ข้อ real-time ทันทีที่เริ่มพิมพ์
- แต่ละข้อแสดง `·` (ยังไม่พิมพ์) → `✓ เขียว` (ผ่าน) → `✕ แดง` (ยังไม่ผ่าน)
- กรอบ input confirm เป็นแดงถ้า password ไม่ตรงกัน
- แสดง error banner ถ้ากด submit แล้วยังไม่ผ่านเงื่อนไข

**แก้ทั้ง frontend และ backend ให้ตรงกัน**

**ไฟล์:**
- `src/lib/helpers.ts` — `validatePassword()` (ใช้ทั้ง backend + สามารถ import frontend ได้)
- `src/app/change-password/page.tsx` — redesign หน้าทั้งหมด

---

### ✅ 2b. ข้อความ "สาขาซ้ำ" ใน Bulk-Create ปี
**Commit:** `e706468`

**เดิม:** "สาขานี้มีอยู่ในปีนี้แล้ว"
**ใหม่:** "มีสาขาซ้ำในระบบ จะทำการข้ามสาขาที่มีอยู่แล้ว"

แก้ 2 จุด — toast error ตอนเพิ่มสาขาเดียว + badge preview ในโหมด "เปิดปีพร้อมทุกสาขา"

**ไฟล์:** `src/app/admin/years/new/page.tsx`

---

### ✅ 3. ปุ่ม "ยกเลิก" → พื้นแดง ตัวขาว ทั่วระบบ
**Commit:** `7218c92`

**เดิม:** ปุ่มยกเลิกทั่วระบบใช้ class `btn` — พื้นขาว ขอบเทา เหมือนปุ่มทั่วไป

**ใหม่:** เพิ่ม CSS class `.btn-cancel` = พื้นแดง (`bg-red-600`) + ตัวอักษรขาว + hover เข้มขึ้น

**ครอบคลุม 15 จุดใน 13 ไฟล์:**

| ไฟล์ | จำนวนปุ่ม |
|---|---|
| `ConfirmDialog.tsx` | 1 (ปุ่มยกเลิกของ confirm dialog ทุกตัวในระบบ) |
| `YearPickerModal.tsx` | 1 |
| `ApprovalPreviewModal.tsx` | 1 |
| `CourseUsageModal.tsx` | 1 |
| `change-password/page.tsx` | 1 |
| `admin/years/new/page.tsx` | 3 |
| `admin/users/[role]/page.tsx` | 2 |
| `teacher/years/new/page.tsx` | 1 |
| `teacher/uni-courses/page.tsx` | 2 |
| `teacher/transfer-groups/page.tsx` | 1 |
| `teacher/students/page.tsx` | 1 |
| `teacher/programs/page.tsx` | 1 |
| `teacher/faculties/page.tsx` | 1 |

> **Note:** `ConfirmDialog.tsx` ครอบทุก confirm dialog ในระบบ — แก้ที่เดียว แต่ทุกหน้าที่ใช้ askConfirm() ได้รับผลทันที

**ไฟล์หลัก:** `src/app/globals.css` (เพิ่ม `.btn-cancel`)

---

### ✅ 4. Bug นักศึกษา — ระบบฟ้องซ้ำสับสน
**Commit:** `ff43ce5`

**ปัญหาเดิมที่ทำให้สับสน 3 อย่าง:**

**① Error message เป็นอังกฤษ**
ระบบ return `"studentId exists"` → frontend แสดงตรงๆ ผู้ใช้ไม่รู้ว่าหมายถึงอะไร มองไปที่ list เห็นชื่อซ้ำ เลยคิดว่าระบบ reject เพราะชื่อ ทั้งที่จริงๆ reject เพราะ **รหัสนักศึกษาซ้ำ**

**② ไม่ trim whitespace**
ถ้า studentId มี space หน้า/หลัง (copy-paste จาก Excel):
```
"63010001"   ≠   "63010001 "  (มี space ต่อท้าย)
```
MongoDB ถือว่าต่างกัน → สร้างได้! → list แสดงชื่อซ้ำ 2 บรรทัด ทั้งที่เป็นคนเดียวกัน

**③ ไม่มี client-side pre-check**
ต้องรอส่งไป server ก่อนถึงรู้ว่าซ้ำ

**แก้แล้ว:**

| | ก่อนแก้ | หลังแก้ |
|---|---|---|
| Error message | `"studentId exists"` | `"รหัสนักศึกษา 63010001 มีอยู่ในระบบแล้ว"` |
| Whitespace | ไม่ trim → สร้าง record ซ้ำได้ | trim() ทั้ง frontend + backend |
| Pre-check | ไม่มี | เช็คใน list ที่โหลดมาแล้วก่อน submit |

**ระบบตรวจอะไรบ้าง:**
- ✅ **studentId ซ้ำ → บล็อก** (เสมอ ทั้งชื่อเหมือนหรือต่างกัน)
- ✅ **studentId ซ้ำจาก whitespace → บล็อก** (ใหม่)
- ⚪ **fullName ซ้ำ → ผ่านได้** (ถูกต้อง — มหาวิทยาลัยมีนักศึกษาชื่อเดียวกันได้)

**ตัวอย่าง:**
```
ในระบบ:  ID=63010001  ชื่อ=สมชาย
เพิ่มใหม่: ID=63010001  ชื่อ=สมหญิง  →  ❌ "รหัสนักศึกษา 63010001 มีอยู่ในระบบแล้ว"
เพิ่มใหม่: ID=63010002  ชื่อ=สมชาย   →  ✅ เพิ่มได้ (คนละคน ชื่อซ้ำได้)
เพิ่มใหม่: ID="63010001 " (มี space) →  ❌ บล็อกหลัง trim
```

**ไฟล์:**
- `src/app/api/students/route.ts` — trim + เปลี่ยน error message
- `src/app/teacher/students/page.tsx` — trim + pre-check ก่อน submit

---

### ✅ 5. ข้อความแสดงปีการศึกษา
**Commit:** `09f3cd0`

**เดิม:** แสดงเป็น "ปี 2569" ทุกที่
**ใหม่:** เปลี่ยนตามตำแหน่ง:

| ตำแหน่ง | ก่อน | หลัง |
|---|---|---|
| ปุ่ม Navbar | `ปี 2569` | `ปีการศึกษา 2569` |
| รายการใน dropdown | `ปี 2569` | `ใบเทียบรายวิชา ปีการศึกษา 2569` |
| ปุ่มยืนยันใน YearPickerModal | `(ปี 2569)` | `(ปีการศึกษา 2569)` |
| หัวข้อหน้า sheets/students/dashboard | `ปี 2569` | `ปีการศึกษา 2569` |

**ไฟล์:**
- `src/components/NavYearSelector.tsx`
- `src/components/YearPickerModal.tsx`
- `src/app/teacher/sheets/page.tsx`
- `src/app/teacher/students/page.tsx`
- `src/app/teacher/page.tsx`

---

### ✅ 6. ตัดฟีเจอร์คณะออก
**Commit:** `56f623f`

**สาเหตุ:** ไม่ต้องการ management UI สำหรับคณะแล้ว (ใช้ string ตรงๆ แทน)

**ไฟล์ที่ลบ (5 ไฟล์):**
- `src/models/Faculty.ts`
- `src/app/api/faculties/route.ts` + `[id]/route.ts`
- `src/app/teacher/faculties/page.tsx`
- `src/app/admin/faculties/page.tsx`

**ไฟล์ที่แก้ (5 ไฟล์):**
- `admin/layout.tsx` + `teacher/layout.tsx` — ลบลิงก์เมนูคณะ
- `admin/page.tsx` — ลบ StatCard + fetch `/api/faculties`
- `teacher/programs/page.tsx` — เปลี่ยน faculty dropdown → text input (พิมพ์เองได้)
- `src/lib/db.ts` — ลบ `import '@/models/Faculty'`

**ที่ไม่ได้แตะ:**
- `Program.faculty` และ `Student.faculty` string field ยังอยู่ — PDF + display ยังใช้ได้ปกติ

---

### ✅ 7. ปุ่ม "ลืมรหัสผ่าน?" ใน Login Page
**Commit:** `5a55b39`

**เพิ่มอะไร:**
- ปุ่ม `ลืมรหัสผ่าน?` เล็กๆ underline ใต้ฟอร์ม login
- กดแล้วเปิด modal แสดงข้อความ:
  > "หากท่านลืมรหัสผ่าน โปรดติดต่อ ผู้ดูแลระบบ / อาจารย์ / ผู้ที่เกี่ยวข้อง"
- ปิดด้วยปุ่ม ✕ / คลิก backdrop / กด "รับทราบ"
- Design เข้าธีมระบบ — surface + backdrop blur + animate-slideUp

**ไฟล์:** `src/app/login/page.tsx`

---

### ✅ 8. สลับสิทธิ์ teacher ↔ committee
**Commit:** `4f1ca8d`

**เปลี่ยนแปลงหลัก:**

| | ก่อน | หลัง |
|---|---|---|
| **teacher** | จัดการทุกอย่าง + ส่งพิจารณา | **ดูได้อย่างเดียว** |
| **committee** | ดูแค่ นศ./ใบเทียบ/รายงาน | **จัดการได้ทุกอย่าง** เหมือน teacher เดิม |
| **workflow** | teacher กรอก → submit → committee approve | **committee ทำทั้งหมดเอง** |

**Part 1 — API (12 ไฟล์)**
เปลี่ยน `requireRole(['admin', 'teacher'])` → `requireRole(['admin', 'committee'])` ในทุก mutation endpoint:
- students, students/import, students/[id]
- programs, programs/[id]
- years (POST)
- transfer-groups, transfer-groups/[id]
- uni-courses, uni-courses/[id]
- sheets (POST), sheets/[id] (PATCH+DELETE)

ลบข้อจำกัดเดิมที่ committee ไม่สามารถแก้ draft sheet ได้ — ตอนนี้ committee แก้ได้ทุก status

**Part 2 — Layout (1 ไฟล์)**
`committeeLinks` → full menu เหมือน teacherLinks เดิม (📅/🎓/📚/นศ/ใบเทียบ/รายงาน)

**Part 3 — Page UI (7 ไฟล์)**
เพิ่ม `isReadOnly = role === 'teacher'` ในทุกหน้า teacher และ wrap mutation UI:
- ซ่อน: ปุ่ม Add/Edit/Delete ทุกตัว, form เพิ่มข้อมูล, import CSV
- เหลือ: ดูรายการ, เปิด PDF, ดูใบเทียบ (read-only)

**Sheet workflow ใหม่ใน `sheets/[studentId]/page.tsx`:**
- Teacher → `isLocked = true` เสมอ (ดูได้อย่างเดียว ไม่มีปุ่ม action)
- Committee → `isLocked = isFinalized` เท่านั้น (แก้ได้จนกว่าจะ finalize)
- ปุ่ม "ส่งพิจารณา" (submitForReview) ถูกลบออกแล้ว
- ปุ่ม "✓ อนุมัติ" ใช้ได้ทั้งจาก draft และ pending_review

---

## Deploy Log

| วันที่ | Commit | รายละเอียด | สถานะ |
|---|---|---|---|
| 2026-07-02 | `03a1dc3` | feat: ปุ่มลบปีใน YearPickerModal | ✅ |
| 2026-07-02 | `eafb676` | fix: AuditAction type | ✅ |
| 2026-07-02 | `a03d92b` | fix: email login | ✅ |
| 2026-07-02 | `c8e1775` | feat: password requirements + UI | ✅ |
| 2026-07-02 | `e706468` | fix: duplicate branch message | ✅ |
| 2026-07-02 | `7218c92` | feat: btn-cancel ยกเลิก ทั่วระบบ | ✅ |
| 2026-07-02 | `ff43ce5` | fix: student duplicate detection | ✅ |
| 2026-07-02 | `524e018` | docs: CHANGELOG.md | ✅ |
| 2026-07-02 | `09f3cd0` | feat: year display text | ✅ |
| 2026-07-02 | `56f623f` | feat: remove faculty feature | ✅ |
| 2026-07-02 | `5a55b39` | feat: forgot password modal | ✅ |
| 2026-07-02 | `4f1ca8d` | feat: swap teacher/committee permissions | ✅ |
