'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type RoleCard = {
  role: string;
  label: string;
  icon: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
};

const roles: RoleCard[] = [
  {
    role: 'admin',
    label: 'Admin',
    icon: '👑',
    description: 'ผู้ดูแลระบบ — จัดการทุกอย่างในระบบ',
    color: 'text-brand-700',
    bgColor: 'bg-brand-50',
    borderColor: 'border-brand-200',
  },
  {
    role: 'teacher',
    label: 'Teacher',
    icon: '👨‍🏫',
    description: 'อาจารย์ — จัดการข้อมูลนักศึกษาและใบเทียบโอน',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  {
    role: 'committee',
    label: 'Committee',
    icon: '📋',
    description: 'กรรมการ — พิจารณาและอนุมัติใบเทียบโอน',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  {
    role: 'student',
    label: 'Student',
    icon: '🎓',
    description: 'นักศึกษา — ดูข้อมูลและใบเทียบโอนของตนเอง',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
];

export default function UsersIndexPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCounts();
  }, []);

  async function loadCounts() {
    setLoading(true);
    try {
      const users = await (await fetch('/api/users')).json();
      const c: Record<string, number> = {
        admin: 0,
        teacher: 0,
        committee: 0,
        student: 0,
      };
      users.forEach((u: any) => {
        if (c[u.role] !== undefined) c[u.role]++;
      });
      setCounts(c);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* Hero */}
      <section className="page-hero surface-pad-lg">
        <div className="page-eyebrow">👥 ผู้ใช้งาน</div>
        <h1 className="page-title">จัดการผู้ใช้งาน</h1>
        <p className="text-sm text-slate-600 mt-2">
          เลือก Role ที่ต้องการจัดการ
        </p>
      </section>

      {/* Role Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {roles.map(r => (
          <Link
            key={r.role}
            href={`/admin/users/${r.role}`}
            className={`surface surface-pad ${r.bgColor} ${r.borderColor} hover:shadow-lift transition-all duration-200 group cursor-pointer`}
          >
            <div className="flex items-start gap-4">
              <div className={`text-5xl ${r.color} group-hover:scale-110 transition-transform`}>
                {r.icon}
              </div>
              <div className="flex-1">
                <h3 className={`text-xl font-semibold ${r.color} mb-1`}>
                  {r.label}
                </h3>
                <p className="text-sm text-slate-600 mb-3">
                  {r.description}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">จำนวนผู้ใช้:</span>
                  {loading ? (
                    <div className="skeleton h-6 w-12 rounded-full" />
                  ) : (
                    <span className={`text-2xl font-bold ${r.color}`}>
                      {counts[r.role] || 0}
                    </span>
                  )}
                  <span className="text-xs text-slate-500">คน</span>
                </div>
              </div>
              <div className={`text-2xl ${r.color} opacity-0 group-hover:opacity-100 transition-opacity`}>
                →
              </div>
            </div>
          </Link>
        ))}
      </section>

      {/* Quick Guide */}
      <section className="surface surface-pad border-l-4 border-brand-400 bg-gradient-to-r from-brand-50/50 to-transparent">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="text-2xl">💡</div>
            <h3 className="text-base font-semibold text-brand-700">แนะนำการใช้งาน</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white/60 border border-slate-200/60">
              <div className="text-lg mt-0.5">🔍</div>
              <div>
                <p className="font-medium text-slate-800">ดูรายชื่อ</p>
                <p className="text-xs text-slate-600 mt-0.5">คลิกการ์ดเพื่อดูผู้ใช้แต่ละ Role</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white/60 border border-slate-200/60">
              <div className="text-lg mt-0.5">⚙️</div>
              <div>
                <p className="font-medium text-slate-800">จัดการผู้ใช้</p>
                <p className="text-xs text-slate-600 mt-0.5">เพิ่ม แก้ไข ลบ และรีเซ็ตรหัสผ่าน</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white/60 border border-slate-200/60">
              <div className="text-lg mt-0.5">📊</div>
              <div>
                <p className="font-medium text-slate-800">ข้อมูลเพิ่มเติม</p>
                <p className="text-xs text-slate-600 mt-0.5">Student แสดงคณะ สาขา และปีการศึกษา</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
