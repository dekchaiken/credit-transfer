'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { NavLink } from '@/components/Nav';

export default function Sidebar({ links, open, onClose }: {
  links: NavLink[];
  open: boolean;
  onClose: () => void;
}) {
  const path = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  function isActive(href: string) {
    if (!path) return false;
    if (path === href) return true;
    const segments = href.split('/').filter(Boolean);
    if (segments.length <= 1) return false;
    return path.startsWith(href + '/');
  }

  function isGroupActive(children: { href: string }[]) {
    return children.some(c => isActive(c.href));
  }

  // Auto-open active group on mount / path change
  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const l of links) {
      if ('children' in l && l.children && isGroupActive(l.children)) {
        next[l.label] = true;
      }
    }
    setOpenGroups(prev => ({ ...next, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Close mobile drawer on path change
  useEffect(() => { onClose(); }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleGroup(label: string) {
    setOpenGroups(g => ({ ...g, [label]: !g[label] }));
  }

  const inner = (
    <nav className="p-3 space-y-0.5">
      {links.map(l => {
        if ('children' in l && l.children) {
          const active = isGroupActive(l.children);
          const isOpen = openGroups[l.label] ?? active;
          return (
            <div key={l.label}>
              <button
                onClick={() => toggleGroup(l.label)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition
                  ${active ? 'text-brand-700 font-medium bg-brand-50/60' : 'text-slate-700 hover:bg-soft'}`}
              >
                <span>{l.label}</span>
                <span className={`text-[9px] text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {isOpen && (
                <div className="mt-0.5 ml-2 pl-2 border-l border-line space-y-0.5 animate-slideDown">
                  {l.children.map(c => (
                    <Link key={c.href} href={c.href}
                      className={`block px-3 py-1.5 rounded-md text-sm transition
                        ${isActive(c.href) ? 'text-brand-700 font-medium bg-brand-50/60' : 'text-slate-600 hover:bg-soft hover:text-ink'}`}>
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        }
        return (
          <Link key={l.href} href={l.href}
            className={`block px-3 py-2 rounded-md text-sm transition
              ${isActive(l.href) ? 'text-brand-700 font-medium bg-brand-50/60' : 'text-slate-700 hover:bg-soft'}`}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-60 shrink-0 border-r border-line bg-white sticky top-14 self-start no-print"
        style={{ height: 'calc(100vh - 3.5rem)' }}>
        <div className="h-full overflow-y-auto">{inner}</div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 no-print" onClick={onClose}>
          <div className="absolute inset-0 bg-black/30 animate-fadeIn" />
          <div
            className="absolute left-0 top-14 bottom-0 w-64 bg-white border-r border-line shadow-lift animate-slideDown"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-full overflow-y-auto">{inner}</div>
          </div>
        </div>
      )}
    </>
  );
}
