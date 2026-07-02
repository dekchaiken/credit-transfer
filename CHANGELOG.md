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

## งานที่ยังเหลือ

| # | หัวข้อ | สถานะ |
|---|---|---|
| 5 | เพิ่มข้อความ "(ใบเทียบรายวิชา ปีการศึกษา XXXX)" หน้าปี | ⬜ |
| 6 | ตัดฟีเจอร์คณะออก | ⬜ |
| 7 | ปุ่มลืมรหัสผ่าน popup | ⬜ |
| 8 | สลับสิทธิ์ teacher ↔ committee | ❓ รอ clarify |
