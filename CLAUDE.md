# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ระบบใบเทียบโอนรายวิชา (Credit Transfer) for **มทร.กรุงเทพ (RMUTK)** — generates the **สวท. 12-05** PDF form. The actual app lives in the `credit-transfer/` subdirectory; treat it as the project root for everything below.

Stack: Next.js 15 (App Router) + TypeScript, MongoDB + Mongoose, NextAuth (credentials, JWT), TailwindCSS, @react-pdf/renderer, papaparse.

## Commands

Run from `credit-transfer/`:

```bash
npm install
npm run dev              # next dev — local MongoDB must be running
npm run build && npm start
npm run lint             # next lint
npm run seed             # seed admin (admin / admin1234) — uses .env.local
npm run seed:data        # seed RMUTK faculties + IT-DBT program + 2569 year + 14 courses + ~60 groups + 3 test students
```

One-shot scripts under `scripts/` are run via `npx tsx scripts/<name>.ts`. Notable:
- `scripts/migrate-offerings.ts` — backfills `CourseOffering` join docs from legacy `UniCourse.yearId`. Supports `--dry` flag. Idempotent; safe to re-run.

There is **no test suite**. There is **no single-test command**. Verify changes by running `npm run dev` and exercising flows in the browser. PDF rendering happens server-side via `/api/sheets/[id]/pdf`.

Local MongoDB: `mongodb://127.0.0.1:27017/credit_transfer` (override with `MONGODB_URI`). On Windows: `sc query MongoDB` to check the service. To reset state: `mongosh credit_transfer --eval "db.dropDatabase()"` then re-seed.

For quick DB introspection without a Mongo shell, use one-shot `npx tsx -e "..."` scripts importing the models from `./src/models/*` and connecting via `MONGODB_URI`. The connection cache in `db.ts` is dev-server-specific, so standalone scripts must call `mongoose.connect` directly (then `disconnect` at the end).

`.env.local` must define `NEXTAUTH_SECRET` and (optionally) `MONGODB_URI`, `NEXTAUTH_URL`.

For full setup/test scenarios across all 4 roles, see `GUIDE.md` — it contains the canonical end-to-end test walkthrough and trouble-shooting table.

## Architecture

### Roles & auth flow

Four roles defined in `@/lib/auth.ts`: `admin`, `teacher`, `committee`, `student`. `committee` accesses `/teacher/*` routes but has **restricted permissions** — cannot manage master data (programs, faculties, transfer groups, students). In the sidebar, `committee` sees only: หน้าแรก, นักศึกษา, ใบเทียบโอน, รายงาน. The dashboard (`/teacher`) shows different stat cards per role.

Auth is enforced in **three layers** — keep all three in sync when adding new routes:

1. **`src/middleware.ts`** — JWT-based redirects. Also enforces `mustChangePassword` by redirecting to `/change-password` (whitelisted: `/change-password` page itself + `/api/users/me/password`). Page-prefix → role mapping lives here.
2. **Layouts** under `src/app/{admin,teacher,student}/layout.tsx` — server-side `getSession()` guards as a defense-in-depth layer.
3. **API routes** — every mutating handler calls `await requireRole([...])` from `@/lib/auth.ts`. `requireRole` **throws a `Response` object** (not a thrown Error). The pattern in handlers is:
   ```ts
   try { await requireRole(['admin', 'teacher']); } catch (e: any) { return e; }
   ```
   When relaxing permissions, check both POST and `[id]/route.ts` (DELETE/PUT) — they are separate files and have historically drifted (e.g., teacher could create programs but not delete them).

`authOptions` lives in `@/src/lib/authOptions.ts` (not the route file) because Next.js 15 forbids non-handler exports from `route.ts`. The route handler in `src/app/api/auth/[...nextauth]/route.ts` is a thin wrapper that imports + re-exports. Session shape: `session.user.{userId, role, studentId, mustChangePassword}` (see the `session()` callback). The JWT supports `trigger === 'update'` so client code can refresh `mustChangePassword` after change-password without re-logging in.

### Data model & relationships

Schemas live under `src/models/`. The relationship chain matters because `populate()` is used heavily:

```
Faculty (string name only) ──▶ Program.faculty (denormalized string)
Program ──▶ AcademicYear ──┐
                            ├──▶ CourseOffering ◀── UniCourse (central catalog)
                            │           │
                            │           └─ order (per-year)
                            └──▶ Student
                                   │
                                   └──▶ TransferSheet (1:1 with Student via unique index)
                                           │
                                           └── selections[]: { uniCourseId, groupNo, grade, outsideCE, selected }

UniCourse ──▶ TransferGroup ──▶ ExternalCourse[]   (groups are course-scoped, shared across years/programs)
```

Key invariants:
- **`UniCourse` is a global catalog**, not year-scoped. The same `UniCourse` doc is reused across multiple `(year, program)` pairs via `CourseOffering` join docs. `UniCourse.yearId` is **vestigial** — kept on the schema (sparse, optional) for legacy data but new code must not rely on it. Use `findCoursesByYearId(yearId)` from `@/lib/courseQueries.ts` to list courses for a year (it joins through `CourseOffering` and returns the legacy shape with the offering's `order`).
- **`CourseOffering` is the (uniCourseId, yearId) join table.** Unique compound index. Carries per-year `order`. When deleting a `UniCourse`, **cascade delete all its `CourseOffering` docs and `TransferGroup`s**. When deleting an `AcademicYear`, **cascade delete the offerings for that year** (the catalog course itself stays). The bulk-replace endpoint is `PUT /api/uni-courses/[id]/offerings` with `{ items: [{yearId, order}] }`.
- **`TransferGroup` is course-scoped, not year-scoped.** Groups attach to `UniCourse._id` and are **shared across every year/program that offers the course**. Editing a group affects all programs simultaneously — this is intentional (option ก in the catalog refactor). The `/teacher/transfer-groups` page is reached via `?uniId=<UniCourse._id>` only; there is no longer a year context for groups.
- **`AcademicYear` is per (year, program)** — uniqueness on `{ year, programId }`. Multiple programs in the same year are multiple separate `AcademicYear` documents. The `/teacher/years` page groups them visually but they are flat in the DB.
- **`TransferSheet.selections` is an array, not a map.** Multiple selections can share the same `uniCourseId` with different `groupNo` — this enables "select more than one transfer group per uni course." When reading selections in the PDF/edit page, key by `${uniCourseId}|${groupNo}`, not by `uniCourseId` alone.
- **`Program.faculty` is a denormalized string** (the faculty's full `nameTh`, **including the "คณะ" prefix**), not an ObjectId ref. Renaming a faculty does not propagate. The faculty-usage table on `/teacher/faculties` joins both collections client-side using **NFC normalize + trim** on both sides — if you write new code that compares faculty names, do the same or you will get false negatives from invisible Unicode/whitespace mismatches. The seed file `scripts/seed-data.ts` must use the full `"คณะX"` form to stay in sync.
- **`UniCourse.code` is NFC-normalized + trimmed** before insert. `findOrCreateCatalogCourse()` (`@/lib/courseQueries.ts`) is the canonical create path — it dedupes by normalized `code` and throws `NAME_CONFLICT` if a duplicate code has a different `nameTh`. Never bypass it.
- **`TransferSheet.selections[].selected`** — boolean field. การติ๊ก "เลือก" โดยกรรมการ/อาจารย์คือเงื่อนไขผ่านการเทียบโอน ต่างจาก `groupNo != null` ซึ่งแค่หมายถึงเลือก group ไว้. `transferredCount` ใน PDF และ stats นับจาก `selected: true` เท่านั้น. When creating new selections, always set `selected: true` by default.
- **`TransferSheet.selections[].outsideCE`** — boolean field. ระบุว่าเป็นวิชานอกระบบ CE หรือไม่ แยกจาก `selected` (สามารถติ๊ก outsideCE โดยไม่ต้องติ๊ก selected). แสดงใน PDF คอลัมน์ "นอกระบบ CE" เมื่อ `outsideCE: true`.
- **`TransferSheet.status`** — สามค่า: `draft` → `pending_review` → `finalized`. Teacher ส่งพิจารณาได้ (draft→pending_review) และดึงกลับได้ (pending_review→draft, finalized→draft). Committee เห็นเฉพาะ pending_review+finalized, แก้ไขได้ใน pending_review, อนุมัติ (→finalized) หรือส่งกลับ (→draft/pending_review) ได้. Auto-save **ไม่ส่ง `status`** — status เปลี่ยนได้เฉพาะผ่าน explicit PATCH `{ status: newStatus }` เท่านั้น.
- **`Program.code`** — optional แล้ว (ไม่ required, ไม่ unique). ไม่แสดงใน UI อีกต่อไป ใช้ `nameTh` แทนทุกที่.

### Cascade-delete invariants

A few delete paths cascade across collections — do not introduce new delete handlers without checking these:

- **`DELETE /api/students/[id]`** removes the `Student`, all of that student's `TransferSheet` docs, **and** the matching `User` row (`{ role: 'student', studentId: stu.studentId }`). Without the User cascade you get orphan login accounts that survive across re-imports.
- **`DELETE /api/uni-courses/[id]`** cascades to **all `TransferGroup`s for that course AND all `CourseOffering` docs** (every program/year that used it). Confirm wording on the catalog page surfaces this — keep it accurate if you change cascade scope.
- **`DELETE /api/years/[id]`** must call `invalidateYears()` (from `@/lib/yearsCache`) and should remove the year's `CourseOffering` docs (catalog courses themselves stay).
- **`DELETE /api/users/[id]`** refuses to delete the currently-signed-in admin (compares `session.user.userId === id`). `PUT /api/users/[id]` also refuses to demote the current admin to a non-admin role. Mirror this on any new self-affecting endpoint.

### Mongoose registration trap

`src/lib/db.ts` **eagerly imports every model file at module load** so that `populate()` works regardless of which route is hit first. When adding a new model, **add an import to `db.ts`** or `populate()` will throw `MissingSchemaError` intermittently in dev (HMR can deregister schemas).

### Dev-mode connection cache

`db.ts` stashes the mongoose connection on `globalThis._mongoose` to survive Next.js HMR. Don't call `mongoose.connect` directly in app code — always use `dbConnect()`. (One-off CLI scripts under `scripts/` are the exception.)

### PDF rendering (`@react-pdf/renderer`)

`src/components/pdf/TransferSheetPDF.tsx` is the **source of layout truth** for the สวท. 12-05 form. Two non-obvious behaviors:

1. **`Font.register` is module-level and process-cached.** Editing the font URL **requires a full dev-server restart** (Next.js HMR does not re-run module-level code that has already executed). If you see "Failed to fetch font" with a URL you already changed, restart `npm run dev` and clear `.next/`.
2. **Working font URL pattern**: `https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sarabun/Sarabun-{Regular,Bold}.ttf`. The `@main` is required — versionless paths and `fonts.gstatic.com/v15/...` URLs both 404 (the latter rotates).
3. **Font limitations**: TH Sarabun PSK does not support Unicode symbols like ✓ (U+2713). Use `/` (Thai checkmark) or other ASCII characters instead. Always test symbol rendering after font changes.

Form-layout conventions inside the PDF component:
- Fixed top header (logo block + form code) and fixed bottom footer (ASCAR text) use `<View fixed>` so they repeat per page.
- Student-info block sits **between** the fixed header and the table → it renders only on page 1 (no `fixed`).
- The summary line + 3 signature blocks sit after the table → they render only on the final page.
- Table header is two visual rows because "รายวิชาที่ขอเทียบโอน" spans 3 sub-columns; this is implemented as a column of two stacked `View`s, while sibling header cells use `height: 36` to match. Column widths must sum to 100% across header AND body — the merged section width must equal `cExtCode + cExtName + cExtCred`.
- The university logo style `uniLogo` uses width:height = 30:52 (~1:1.73) to match the source PNG's aspect ratio; changing the box without adjusting `objectFit: 'contain'` will visibly squish the crest.
- **Checkmark columns**: "เลือก (/)" shows `/` when `isSelected && groupSel.selected`. "นอกระบบ CE" shows `/` when `isSelected && groupSel.outsideCE`. Both require a selection to exist (`isSelected = !!groupSel`) before checking the boolean flags.

### Logo assets

Logos live under `public/logo/`:
- `logoRMUTT-color.png` — full-color, used by `Nav.tsx` (the brand block; the image is portrait so it sits inside an `object-contain` box, not in a colored square).
- `logoRMUTT-back.png` — black-on-transparent, loaded server-side by `loadLogoDataUrl()` in `src/app/api/sheets/[id]/pdf/route.ts` and embedded as a base64 data URL in the PDF. Falls back to `rmutk.png` for legacy installs.
- `ASCAR.png` — used in the PDF fixed footer (loaded via the same `loadLogoDataUrl()` helper, with case-insensitive fallback to `ascar.png`).

### CSV import (students)

`POST /api/students/import?yearId=<id>` reads CSV with columns `studentId, fullName, programCode`. **The year is taken from the query param, not the CSV** — the UI in `/teacher/students` always passes the year currently selected at the top of the page. Each imported student also triggers `ensureStudentUser` (`src/lib/studentUser.ts`) to create a NextAuth user with `username = studentId, password = "1234", mustChangePassword = true`.

### Teacher selection flow (URL-driven + active-year fallback)

The four teacher pages each have their own URL-param contract, but they share a **global "active year"** state via `useActiveYear()` so the user only picks a year once per session.

URL params per page:
- `/teacher/years` — `?year=NNNN` (no program scope; lists all programs for the year)
- `/teacher/uni-courses` — **central catalog**, no year scope. Lists every `UniCourse` with an `offeringCount` badge. Year/program assignment happens via the **🎯 ใช้ในหลักสูตร** button which opens `CourseUsageModal`.
- `/teacher/transfer-groups` — `?uniId=<UniCourse._id>` only. Groups are course-scoped now (see Data model). Reached from the catalog's **📦 กลุ่มเทียบ** button.
- `/teacher/students` — `?year=NNNN&yearId=<id>` (legacy `?yearId=` alone is auto-resolved)
- `/teacher/sheets` — `?year=NNNN&yearId=<id>`

Shared state primitives (in `src/lib/`):
- **`useActiveYear.ts`** — hook used by every year-scoped page. URL is the **primary** source of truth; `localStorage['ct.activeYear']` is the **fallback default** when URL has no `?year=`. The hook auto-fills the URL from localStorage on first render (silent `router.replace`), opens the picker only when both are empty or the stored year was deleted, and exposes `setYear(y)` which writes localStorage + URL + clears narrower params (`yearId`, `uniId`, `programId`, `faculty`). Also folds in the legacy resolvers via `resolveFrom?: 'yearId' | 'uniId'` option.
- **`yearsCache.ts`** — module-level promise cache for `/api/years`. `getYears(force?)` + `invalidateYears()`. **Mutation routes that touch `AcademicYear` (create/delete) must call `invalidateYears()`** or the Nav selector will show stale data.
- **`@/components/NavYearSelector.tsx`** — dropdown rendered in the Nav (`extraRight` slot for desktop, `extraMobile` for mobile drawer). Switches the active year globally; uses the same `setYear` from the hook.
- **`@/components/YearPickerModal.tsx`** — large modal kept for the "first time / no year yet" + manual "🔄 เปลี่ยนปี" flows. 2-step tentative-then-confirm interaction.
- **`@/components/CourseUsageModal.tsx`** — opens from the catalog page's "🎯 ใช้ในหลักสูตร" button. Bulk-edits a course's `CourseOffering` docs across every (program, year) combo via `PUT /api/uni-courses/[id]/offerings`.

When adding a new year-scoped page, **use `useActiveYear()`** — do not re-implement the years-fetch + picker + localStorage dance. The reference is `src/app/teacher/sheets/page.tsx`.

### UI design system

`src/app/globals.css` defines the entire design system as utility-style classes — composed via `@apply`. Key tokens:

- **Containers/spacing**: `.surface`, `.surface-pad` (p-5/6/7), `.surface-pad-lg` (p-6/8/10), `.container-page`, `.bg-soft`.
- **Page headers**: `.page-hero` (gradient brand strip), `.page-eyebrow` (tiny uppercase label), `.page-title` (h1), `.section-title` (h2 inside a surface).
- **Buttons**: `.btn`, `.btn-{primary,danger,ghost,sm,lg}`.
- **Forms**: `.input`, `.label`.
- **Tables/lists**: `.table`, `.badge`, `.badge-{brand,success}`, `.skeleton`.
- **Nav**: `.nav-link`, `.nav-link-active` (underline indicator via `::after` pseudo-element, not pill background), `.chev`.
- **Animations** (defined in `tailwind.config.ts`): `animate-{slideDown, slideUp, pulseSoft, fadeIn, shimmer}`.

Page-level layout convention: `page-hero surface-pad-lg` for the top section → `surface surface-pad` for content sections → toast feedback via `useToast()` from `@/components/Toast`. The reference implementation for the current pattern is `src/app/teacher/uni-courses/page.tsx`.

### Shared interactive components

These are used across pages — prefer them over reimplementing:

- **`@/src/components/ConfirmDialog.tsx`** — replaces `window.confirm()`. Pattern: keep `confirmOpen`, `confirmOpts`, `confirmAction` state, and an `askConfirm(opts, action)` helper. Used on every destructive action; don't introduce new `confirm()` calls.
- **`@/src/components/LoadingOverlay.tsx`** — full-screen progress overlay with two variants (`login` / `logout`). Login uses it after `signIn()` resolves; `Nav.tsx` uses it during logout with an artificial ~1.1s delay so the animation finishes before the hard nav. Animation is driven by `requestAnimationFrame` with an ease-out curve; do **not** add a CSS `transition` on the fill bar's width — it fights with the rAF updates and stutters.
- **`@/src/components/Toast.tsx`** — `useToast()` returns `{ toast({ type, message }) }`. Replaces inline error UI.
- **`@/src/components/Nav.tsx`** — top bar เท่านั้น (Brand + extraRight + user + logout). เมนูย้ายไปอยู่ใน `Sidebar.tsx` แล้ว. Props: `extraRight`, `onToggleSidebar`, `sidebarOpen`.
- **`@/src/components/Sidebar.tsx`** — left sidebar แนวตั้ง. Desktop: fixed width 240px sticky. Mobile: drawer overlay เปิดด้วย hamburger. รับ `links: NavLink[]`, `open`, `onClose`.
- **`@/src/components/AppShell.tsx`** — client wrapper ที่รวม Nav + Sidebar + main content. ใช้ใน layout ทุก role แทนการใช้ Nav โดยตรง. รับ `links`, `extraRight`, `children`.
- **Teacher submenu order** in `src/app/teacher/layout.tsx`: 📅 จัดการปีการศึกษา → 🏛️ จัดการคณะ → 🎓 จัดการสาขาวิชา → 📚 จัดการรายวิชา. Years comes first because it's the most-touched setup step.

### Layout shell (sticky nav + footer)

Both `Nav.tsx` and `Footer.tsx` use CSS `sticky` positioning so they stay visible regardless of viewport height:
- Nav: `sticky top-0 z-30`
- Footer: `sticky bottom-0 z-20`

Page wrapper in `{admin,teacher,student}/layout.tsx` is `min-h-screen flex flex-col` with `<main className="flex-1">` so the footer sticks to the bottom of short pages but scrolls naturally on long ones. Don't add `mt-auto` or large margins to the footer — they fight the sticky positioning.

### Logout gotcha

Use `signOut({ redirect: false })` followed by `window.location.href = '/login'` (a hard navigation). `signOut({ callbackUrl })` hangs in this app — see `src/components/Nav.tsx`. The hard nav is intentional so server components re-evaluate session.

### File layout cheatsheet

- `src/app/{admin,teacher,student}/` — role-scoped pages; each folder has its own `layout.tsx` guard.
- `src/app/api/**/route.ts` — REST endpoints; `[id]/route.ts` files hold mutating verbs (DELETE/PUT) separately from the collection routes.
- `src/app/api/report/route.ts` — `GET ?year=NNNN` returns `{ byCourse, byStudent }` สำหรับหน้ารายงาน เฉพาะ finalized sheets.
- `src/app/teacher/report/page.tsx` — หน้ารายงานสรุปผลการเทียบโอน (teacher + committee).
- `src/components/pdf/TransferSheetPDF.tsx` — the form layout.
- `src/components/AppShell.tsx` — layout wrapper (Nav + Sidebar + main).
- `src/components/Sidebar.tsx` — left sidebar component.
- `src/lib/auth.ts` — `getSession`, `requireRole`, `Role` type.
- `src/lib/authOptions.ts` — NextAuth config (separate so types can be imported elsewhere).
- `src/lib/courseQueries.ts` — `findCoursesByYearId()` (joins through CourseOffering, returns legacy shape) and `findOrCreateCatalogCourse()` (NFC-dedup catalog create).
- `src/lib/useActiveYear.ts` — global active-year hook (URL + localStorage). Use this on every year-scoped page.
- `src/lib/yearsCache.ts` — module singleton for `/api/years`. Mutations to AcademicYear must `invalidateYears()`.
- `src/lib/studentUser.ts` — `ensureStudentUser` helper used by CSV import and single-student create.
- `scripts/seed-data.ts` — copy this file and edit `YEAR` + `COURSES` to seed a different year's data.
- `scripts/migrate-offerings.ts` — backfills `CourseOffering` from legacy per-year `UniCourse` docs (`--dry` for preview).
