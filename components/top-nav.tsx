'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  CheckCircle2,
  LayoutGrid,
  Calendar,
  ListChecks,
  ChevronDown,
  LogOut,
  FolderKanban,
} from 'lucide-react';
import type { ProjectView } from '@/lib/types';

export function TopNav({
  userName,
  userEmail,
  userImage,
}: {
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
}) {
  const pathname = usePathname();
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [projOpen, setProjOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const projRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/projects')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (active && Array.isArray(data)) setProjects(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (projRef.current && !projRef.current.contains(e.target as Node)) setProjOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const navLink = (href: string, label: string, Icon: typeof LayoutGrid) => {
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          active ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
        }`}
      >
        <Icon className="w-4 h-4" />
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2 mr-3">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--accent)' }}
          >
            <CheckCircle2 className="w-4.5 h-4.5 text-white" />
          </span>
          <span className="font-bold text-slate-900 hidden sm:block">Task Tracker</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navLink('/', 'Home', LayoutGrid)}

          {/* Projects dropdown */}
          <div className="relative" ref={projRef}>
            <button
              onClick={() => setProjOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              <FolderKanban className="w-4 h-4" />
              Projects
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {projOpen && (
              <div className="absolute left-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 animate-fade-in">
                {projects.length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-400">No projects yet</div>
                )}
                {projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/p/${p.slug}`}
                    onClick={() => setProjOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: p.color }}
                    />
                    {p.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {navLink('/calendar', 'Calendar', Calendar)}
          {navLink('/templates', 'Templates', ListChecks)}
        </nav>

        <div className="ml-auto relative" ref={userRef}>
          <button
            onClick={() => setUserOpen((o) => !o)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-slate-50 transition-colors"
          >
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userImage} alt="" className="w-7 h-7 rounded-full" />
            ) : (
              <span className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
                {(userName || userEmail || '?').charAt(0).toUpperCase()}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          {userOpen && (
            <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 animate-fade-in">
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="text-sm font-medium text-slate-900 truncate">{userName}</div>
                <div className="text-xs text-slate-400 truncate">{userEmail}</div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
