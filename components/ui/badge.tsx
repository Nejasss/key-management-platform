import * as React from 'react';
import { cn } from '@/lib/utils';

const SIGNAL_STYLES: Record<string, string> = {
  active: 'text-signal-success',
  expired: 'text-signal-warning',
  revoked: 'text-signal-danger',
  unused: 'text-signal-idle',
  admin: 'text-primary',
  user: 'text-signal-idle',
};

/**
 * Status indicator styled like an LED readout — a small dot in the
 * signal color plus a label — rather than a filled pill/chip. Meant to
 * read as system state, not as decoration. Deliberately static (no
 * per-row animation); the one pulsing dot in this app lives in the
 * navbar's system status indicator.
 */
export function Badge({ status, className, children }: { status?: string; className?: string; children: React.ReactNode }) {
  const color = status ? SIGNAL_STYLES[status] ?? SIGNAL_STYLES.unused : SIGNAL_STYLES.unused;
  return (
    <span className={cn('signal-dot inline-flex items-center gap-1.5 text-xs font-medium capitalize', color, className)}>
      <span className="text-foreground/90">{children}</span>
    </span>
  );
}
