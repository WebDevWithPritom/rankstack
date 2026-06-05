'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProject } from '@/context/ProjectContext';
import { LayoutDashboard, KeyRound, ArrowLeftRight, HelpCircle, AlertOctagon, Settings, Database, TrendingUp } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { projects, activeProjectId, setActiveProjectId, isLoading } = useProject();

  const storeMode = process.env.NEXT_PUBLIC_RANKSTACK_STORE || 'local';

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Keywords', href: '/keywords', icon: KeyRound },
    { name: 'Compare', href: '/compare', icon: ArrowLeftRight },
    { name: 'Skipped', href: '/skipped', icon: AlertOctagon },
    { name: 'Google Updates', href: '/google-updates', icon: HelpCircle },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const isActive = (href: string) => {
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Left: Brand + Project Selector */}
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-all-200">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800">
              RankStack
            </span>
          </Link>

          {/* Project Dropdown */}
          <div className="relative">
            {isLoading ? (
              <div className="h-9 w-40 animate-pulse rounded-md bg-slate-100" />
            ) : projects.length === 0 ? (
              <Link 
                href="/settings" 
                className="text-xs text-indigo-600 hover:underline px-3 py-1.5 border border-indigo-200 rounded bg-indigo-50 block"
              >
                + Create Project
              </Link>
            ) : (
              <div className="flex items-center space-x-2">
                <select
                  value={activeProjectId}
                  onChange={(e) => setActiveProjectId(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-800 outline-none hover:border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all-200 cursor-pointer appearance-none shadow-sm"
                  style={{
                    backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23475569' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundSize: '1.25rem',
                    backgroundRepeat: 'no-repeat',
                    minWidth: '160px'
                  }}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-white text-slate-800">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Center: Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all-200 ${
                  active
                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm'
                    : 'text-slate-650 hover:text-indigo-600 hover:bg-slate-50'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: Storage Banner */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-xs text-emerald-600">
            <Database className="h-3 w-3" />
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              {storeMode === 'local' ? 'Local DB' : 'Supabase'}
            </span>
          </div>
        </div>

      </div>

      {/* Mobile navigation container (simple horizontal scrollable bar) */}
      <div className="flex md:hidden border-t border-slate-100 bg-white px-2 py-1 overflow-x-auto space-x-1 scrollbar-none shadow-inner">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                active
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
