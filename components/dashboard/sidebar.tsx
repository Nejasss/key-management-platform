'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  KeyRound,
  PlusCircle,
  Users,
  ScrollText,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/keys', label: 'Keys', icon: KeyRound },
  { href: '/dashboard/generate', label: 'Generate Key', icon: PlusCircle },
  { href: '/dashboard/users', label: 'Users', icon: Users },
  { href: '/dashboard/logs', label: 'Logs', icon: ScrollText },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const content = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
        <div className="flex h-7 w-7 items-center justify-center rounded-sm border border-primary/40 bg-primary/10 text-primary">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Key Management</p>
          <p className="text-[11px] text-muted-foreground font-data">console</p>
        </div>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 border-l-2 px-3.5 py-2 text-sm font-medium transition-colors',
                active
                  ? 'border-primary bg-primary/[0.07] text-primary'
                  : 'border-transparent text-muted-foreground hover:border-border hover:bg-secondary/60 hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-border bg-card/40">{content}</aside>

      {/* Mobile trigger */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 rounded-md border border-border bg-card p-2"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative w-64 bg-card border-r border-border">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3">
              <X className="h-5 w-5" />
            </button>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
