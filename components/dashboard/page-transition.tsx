'use client';

import { usePathname } from 'next/navigation';

/**
 * Wraps dashboard page content so each navigation gets a short,
 * consistent entrance animation. Keying on the pathname forces React to
 * remount the wrapper (and therefore replay the CSS animation) on every
 * route change, without needing a routing/animation library.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="route-transition">
      {children}
    </div>
  );
}
