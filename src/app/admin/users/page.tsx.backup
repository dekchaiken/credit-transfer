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

      {/* Summary */}
      <section className="surface surface-pad bg-soft/50">
        <div className="flex items-center gap-3">
          <div className="text-2xl">ℹ️</div>
          <div className="text-sm text-slate-700">
            <p className="font-medium mb-1">คำแนะนำ</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>คลิกที่การ์ดเพื่อดูรายชื่อผู้ใช้ในแต่ละ Role</li>
              <li>สามารถเพิ่ม แก้ไข ลบ และรีเซ็ตรหัสผ่านได้ในหน้ารายละเอียด</li>
              <li>ผู้ใช้ที่เป็น Student จะแสดงข้อมูลคณะ สาขา และปีการศึกษา</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
