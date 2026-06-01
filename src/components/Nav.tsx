'use client';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';

const ROLE_LABEL: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  teacher: 'อาจารย์',
  committee: 'กรรมการ',
  student: 'นักศึกษา',
};

export type NavLink =
  | { href: string; label: string; children?: undefined }
  | { label: string; href?: undefined; children: { href: string; label: string }[] };

export default function Nav({ extraRight, onToggleSidebar, sidebarOpen }: {
  extraRight?: React.ReactNode;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}) {
  const { data } = useSession();
  const role = (data?.user as any)?.role;
  const name = data?.user?.name;
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut({ redirect: false });
      await new Promise(res => setTimeout(res, 1100));
    } finally { window.location.href = '/login'; }
  }

  return (
    <>
      <LoadingOverlay open={signingOut} variant="logout" duration={1100} />
      <nav className="border-b border-line bg-white no-print sticky top-0 z-30">
        <div className="px-4 sm:px-6 lg:px-8 flex items-center gap-4 h-14">
          {/* Mobile sidebar toggle */}
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="md:hidden p-2 text-slate-600 hover:bg-soft rounded-md"
              aria-label="toggle menu"
            >
              <span className="text-lg leading-none">{sidebarOpen ? '✕' : '☰'}</span>
            </button>
          )}

          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <img src="/logo/logoRMUTT-color.png" alt="RMUTT"
              className="w-9 h-9 object-contain" />
            <div className="leading-tight">
              <div className="font-semibold text-ink text-sm">ระบบใบเทียบโอนรายวิชา</div>
              <div className="text-[10.5px] text-slate-500 hidden lg:block">
                มทร.กรุงเทพ · สวท. 12-05
              </div>
            </div>
          </Link>

          {/* Right cluster */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {extraRight}

            {data?.user && (
              <div className="hidden sm:block text-xs leading-tight text-right pl-2 border-l border-line">
                <div className="font-medium text-ink">{name}</div>
                <div className="text-[10.5px] text-slate-500">{ROLE_LABEL[role] || role}</div>
              </div>
            )}

            <Link href="/change-password"
              className="p-2 text-slate-500 hover:text-ink hover:bg-soft rounded-md transition"
              title="เปลี่ยนรหัสผ่าน">
              <span className="text-sm">🔒</span>
            </Link>
            <button onClick={handleLogout} disabled={signingOut}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition"
              title="ออกจากระบบ">
              <span className="text-sm">↪</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
