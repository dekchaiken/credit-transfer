'use client';
import { useState } from 'react';
import Nav, { type NavLink } from '@/components/Nav';
import Sidebar from '@/components/Sidebar';

export default function AppShell({ links, extraRight, children }: {
  links: NavLink[];
  extraRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <>
      <Nav
        extraRight={extraRight}
        onToggleSidebar={() => setSidebarOpen(v => !v)}
        sidebarOpen={sidebarOpen}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar links={links} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0 container-page py-8 sm:py-10 lg:py-12">{children}</main>
      </div>
    </>
  );
}
