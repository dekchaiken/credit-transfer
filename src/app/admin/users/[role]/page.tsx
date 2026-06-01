'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/Toast';
import ConfirmDialog, { type ConfirmOptions } from '@/components/ConfirmDialog';

type U = {
  _id: string;
  username: string;
  fullName: string;
  role: string;
  studentId?: string;
  mustChangePassword?: boolean;
  studentData?: {
    faculty?: string;
    email?: string;
    programId?: { nameTh?: string };
    yearId?: { year?: number };
  };
};

const roleStyle: Record<string, string> = {
  admin: 'badge badge-brand',
  teacher: 'badge badge-success',
  committee: 'badge',
  student: 'badge',
};
const roleLabel: Record<string, string> = {
  admin: 'Admin', teacher: 'Teacher', committee: 'Committee', student: 'Student',
};
const roleIcon: Record<string, string> = {
  admin: '👑', teacher: '👨‍🏫', committee: '📋', student: '🎓',
};

function UsersSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="surface p-3 animate-pulseSoft flex gap-4 items-center">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-4 flex-1" />
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function UsersRolePage() {
  const params = useParams();
  const router = useRouter();
  const role = params.role as string;
  const { toast } = useToast();
  const { data: session } = useSession();
  const myId = (session?.user as any)?.userId as string | undefined;

  const [users, setUsers] = useState<U[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [yearFilter, setYearFilter] = useState('all');
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: role, studentId: '' });

  // Edit modal
  const [editUser, setEditUser] = useState<U | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', role: 'teacher', studentId: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Reset password modal
  const [resetUser, setResetUser] = useState<U | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [resetMustChange, setResetMustChange] = useState(true);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  function askConfirm(opts: ConfirmOptions, action: () => void) {
    setConfirmOpts(opts); setConfirmAction(() => action); setConfirmOpen(true);
  }

  async function load() {
    setLoading(true);
    try {
      const allUsers = await (await fetch('/api/users')).json();
      setUsers(allUsers.filter((u: U) => u.role === role));
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [role]);

  const filtered = useMemo(() => {
    let r = users;
    if (yearFilter !== 'all' && role === 'student') {
      r = r.filter(u => String(u.studentData?.yearId?.year) === yearFilter);
    }
    const s = q.trim().toLowerCase();
    if (s) r = r.filter(u => u.username.toLowerCase().includes(s) || u.fullName?.toLowerCase().includes(s));
    // Sort by username (numeric/alphabetic)
    r.sort((a, b) => a.username.localeCompare(b.username, undefined, { numeric: true }));
    return r;
  }, [users, yearFilter, q, role]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    users.forEach(u => {
      if (u.studentData?.yearId?.year) {
        years.add(u.studentData.yearId.year);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [users]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const r = await fetch('/api/users', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, role }),
      });
      if (!r.ok) { toast({ type: 'error', message: (await r.json()).error || 'เพิ่มไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: `เพิ่ม ${form.username} แล้ว` });
      setForm({ username: '', password: '', fullName: '', role, studentId: '' });
      setShowForm(false);
      load();
    } finally { setSubmitting(false); }
  }

  function del(u: U) {
    if (myId && String(u._id) === String(myId)) {
      toast({ type: 'error', message: 'ลบบัญชีตัวเองไม่ได้' }); return;
    }
    askConfirm({
      title: `ลบผู้ใช้ "${u.username}"?`,
      message: `${u.fullName || u.username} (${u.role})\nการกระทำนี้ไม่สามารถย้อนกลับได้`,
      confirmText: '🗑 ลบผู้ใช้', cancelText: 'ยกเลิก', variant: 'danger',
    }, async () => {
      const r = await fetch(`/api/users/${u._id}`, { method: 'DELETE' });
      if (!r.ok) { toast({ type: 'error', message: (await r.json().catch(()=>({})))?.error || 'ลบไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: 'ลบแล้ว' });
      load();
    });
  }

  function openEdit(u: U) {
    setEditUser(u);
    setEditForm({ fullName: u.fullName || '', role: u.role, studentId: u.studentId || '' });
  }
  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditSubmitting(true);
    try {
      const r = await fetch(`/api/users/${editUser._id}`, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: editForm.fullName,
          role: editForm.role,
          studentId: editForm.role === 'student' ? editForm.studentId : null,
        }),
      });
      if (!r.ok) {
        toast({ type: 'error', message: (await r.json().catch(()=>({})))?.error || 'แก้ไขไม่สำเร็จ' });
        return;
      }
      toast({ type: 'success', message: `แก้ไข ${editUser.username} แล้ว` });
      setEditUser(null);
      load();
    } finally { setEditSubmitting(false); }
  }

  function openReset(u: U) {
    setResetUser(u);
    setResetPwd('');
    setResetMustChange(u.role === 'student');
  }
  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUser) return;
    if (resetPwd.length < 4) { toast({ type: 'error', message: 'รหัสต้องอย่างน้อย 4 ตัวอักษร' }); return; }
    setResetSubmitting(true);
    try {
      const r = await fetch(`/api/users/${resetUser._id}/reset-password`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: resetPwd, mustChangePassword: resetMustChange }),
      });
      if (!r.ok) {
        toast({ type: 'error', message: (await r.json().catch(()=>({})))?.error || 'รีเซ็ตไม่สำเร็จ' });
        return;
      }
      toast({ type: 'success', message: `รีเซ็ตรหัส ${resetUser.username} แล้ว` });
      setResetUser(null);
      setResetPwd('');
    } finally { setResetSubmitting(false); }
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      <section className="page-hero surface-pad-lg">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <button onClick={() => router.push('/admin/users')} className="text-xs text-brand-600 hover:text-brand-700 mb-2 flex items-center gap-1">
              ← กลับไปเลือก Role
            </button>
            <div className="page-eyebrow flex items-center gap-2">
              <span>{roleIcon[role]}</span>
              <span>ผู้ใช้งาน · {roleLabel[role]}</span>
            </div>
            <h1 className="page-title">จัดการ {roleLabel[role]}</h1>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">ผู้ใช้ทั้งหมด</div>
            <div className="text-3xl font-semibold text-brand-600">{loading ? '…' : users.length}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {role === 'student' && yearOptions.length > 0 && (
            <select
              className="input w-auto min-w-[140px]"
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
            >
              <option value="all">ทุกปีการศึกษา</option>
              {yearOptions.map(y => (
                <option key={y} value={String(y)}>ปี {y}</option>
              ))}
            </select>
          )}
          <input
            className="input flex-1 min-w-[200px]"
            placeholder="🔍 ค้นหา username / ชื่อ..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
      </section>

      <section className="surface surface-pad">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="section-title">➕ เพิ่มผู้ใช้</h2>
          <button onClick={() => setShowForm(v => !v)} className="btn btn-sm">
            {showForm ? '× ปิด' : '+ ฟอร์ม'}
          </button>
        </div>
        {showForm && (
          <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end animate-slideDown">
            <div>
              <label className="label">Username</label>
              <input className="input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div>
              <label className="label">ชื่อ-สกุล</label>
              <input className="input" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="flex gap-2">
              {role === 'student' && (
                <input className="input" placeholder="รหัส นศ." value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} />
              )}
              <button className="btn btn-primary" disabled={submitting}>
                {submitting ? '...' : 'เพิ่ม'}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="surface surface-pad">
        <h2 className="section-title mb-3 flex items-center gap-2">
          📋 รายชื่อผู้ใช้ <span className="badge">{filtered.length}</span>
          {(q || yearFilter !== 'all') && <span className="text-xs text-slate-500">(จาก {users.length})</span>}
        </h2>
        {loading ? <UsersSkeleton /> : filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-500">
            <div className="text-3xl mb-2">📭</div>
            ไม่พบผู้ใช้
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-line rounded-lg">
            <table className="table">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                <tr>
                  <th className="whitespace-nowrap">Username</th>
                  <th className="whitespace-nowrap">ชื่อ-สกุล</th>
                  <th className="whitespace-nowrap">Role</th>
                  {role === 'student' && (
                    <>
                      <th className="whitespace-nowrap">คณะ</th>
                      <th className="whitespace-nowrap">สาขา</th>
                      <th className="whitespace-nowrap">ปีการศึกษา</th>
                      <th className="whitespace-nowrap">อีเมล</th>
                    </>
                  )}
                  {role !== 'student' && <th className="whitespace-nowrap">รหัส นศ.</th>}
                  <th className="whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const isSelf = !!myId && String(u._id) === String(myId);
                  return (
                    <tr key={u._id} className="hover:bg-soft transition">
                      <td className="font-mono text-xs whitespace-nowrap">
                        {u.username}
                        {isSelf && <span className="ml-2 text-[10px] text-emerald-600 font-semibold">(คุณ)</span>}
                      </td>
                      <td className="whitespace-nowrap">
                        {u.fullName}
                        {u.mustChangePassword && (
                          <span className="ml-2 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            🔒 ต้องเปลี่ยนรหัส
                          </span>
                        )}
                      </td>
                      <td><span className={roleStyle[u.role] || 'badge'}>{u.role}</span></td>
                      {role === 'student' && (
                        <>
                          <td className="text-xs text-slate-600 whitespace-nowrap">{u.studentData?.faculty || '—'}</td>
                          <td className="text-xs text-slate-600 whitespace-nowrap">{u.studentData?.programId?.nameTh || '—'}</td>
                          <td className="text-xs text-slate-600 whitespace-nowrap text-center">{u.studentData?.yearId?.year || '—'}</td>
                          <td className="text-xs text-slate-600 font-mono whitespace-nowrap">{u.studentData?.email || '—'}</td>
                        </>
                      )}
                      {role !== 'student' && <td className="font-mono text-xs">{u.studentId || '-'}</td>}
                      <td className="text-right whitespace-nowrap space-x-1">
                        <button onClick={() => openEdit(u)} className="btn btn-sm btn-ghost" title="แก้ไข">✏️</button>
                        <button onClick={() => openReset(u)} className="btn btn-sm btn-ghost" title="รีเซ็ตรหัสผ่าน">🔑</button>
                        <button onClick={() => del(u)} disabled={isSelf}
                          className="btn btn-sm btn-danger disabled:opacity-30 disabled:cursor-not-allowed"
                          title={isSelf ? 'ลบบัญชีตัวเองไม่ได้' : 'ลบ'}>ลบ</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !editSubmitting && setEditUser(null)} />
          <form onSubmit={submitEdit} className="relative w-full max-w-md surface shadow-lift overflow-hidden animate-slideUp">
            <div className="px-6 pt-5 pb-3 border-b border-line">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 grid place-items-center text-lg">✏️</div>
                <div>
                  <h3 className="font-semibold">แก้ไขผู้ใช้</h3>
                  <p className="text-xs text-slate-500 font-mono">{editUser.username}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">ชื่อ-สกุล</label>
                <input className="input" value={editForm.fullName}
                  onChange={e => setEditForm({ ...editForm, fullName: e.target.value })} />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                  <option value="admin">admin</option>
                  <option value="teacher">teacher (อาจารย์)</option>
                  <option value="committee">committee (กรรมการ)</option>
                  <option value="student">student (นักศึกษา)</option>
                </select>
                {myId && String(editUser._id) === String(myId) && editForm.role !== 'admin' && (
                  <p className="text-xs text-red-600 mt-1">⚠️ ลดสิทธิ์ตัวเองไม่ได้</p>
                )}
              </div>
              {editForm.role === 'student' && (
                <div>
                  <label className="label">รหัสนักศึกษา</label>
                  <input className="input" value={editForm.studentId}
                    onChange={e => setEditForm({ ...editForm, studentId: e.target.value })} />
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-soft/60 border-t border-line flex justify-end gap-2">
              <button type="button" onClick={() => setEditUser(null)} disabled={editSubmitting} className="btn">ยกเลิก</button>
              <button type="submit" disabled={editSubmitting} className="btn btn-primary">
                {editSubmitting ? 'กำลังบันทึก...' : '💾 บันทึก'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reset password modal */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !resetSubmitting && setResetUser(null)} />
          <form onSubmit={submitReset} className="relative w-full max-w-md surface shadow-lift overflow-hidden animate-slideUp">
            <div className="px-6 pt-5 pb-3 border-b border-line">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 grid place-items-center text-lg">🔑</div>
                <div>
                  <h3 className="font-semibold">รีเซ็ตรหัสผ่าน</h3>
                  <p className="text-xs text-slate-500 font-mono">{resetUser.username}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">รหัสผ่านใหม่ *</label>
                <input className="input" type="text" value={resetPwd} autoFocus
                  onChange={e => setResetPwd(e.target.value)}
                  placeholder="อย่างน้อย 4 ตัวอักษร" required minLength={4} />
                <p className="text-xs text-slate-500 mt-1">
                  💡 แนะนำให้ใช้รหัสง่ายๆ (เช่น <code>1234</code>) แล้วบังคับให้เปลี่ยนตอนเข้าสู่ระบบครั้งแรก
                </p>
              </div>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={resetMustChange}
                  onChange={e => setResetMustChange(e.target.checked)} />
                <span>
                  <span className="font-medium">บังคับให้เปลี่ยนรหัสตอนเข้าระบบครั้งต่อไป</span>
                  <span className="block text-xs text-slate-500">user จะถูก redirect ไปหน้าเปลี่ยนรหัสก่อนใช้งาน</span>
                </span>
              </label>
            </div>
            <div className="px-6 py-4 bg-soft/60 border-t border-line flex justify-end gap-2">
              <button type="button" onClick={() => setResetUser(null)} disabled={resetSubmitting} className="btn">ยกเลิก</button>
              <button type="submit" disabled={resetSubmitting || resetPwd.length < 4} className="btn btn-primary">
                {resetSubmitting ? 'กำลังรีเซ็ต...' : '🔑 รีเซ็ตรหัสผ่าน'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        options={confirmOpts}
        onConfirm={() => { confirmAction?.(); setConfirmOpen(false); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
