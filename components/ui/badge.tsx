import * as React from 'react';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-success/15 text-success border-success/30',
  expired: 'bg-warning/15 text-warning border-warning/30',
  revoked: 'bg-destructive/15 text-destructive border-destructive/30',
  unused: 'bg-muted text-muted-foreground border-border',
  admin: 'bg-primary/15 text-primary border-primary/30',
  user: 'bg-muted text-muted-foreground border-border',
};

export function Badge({ status, className, children }: { status?: string; className?: string; children: React.ReactNode }) {
  const style = status ? STATUS_STYLES[status] ?? STATUS_STYLES.unused : STATUS_STYLES.unused;
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize', style, className)}>
      {children}
    </span>
  );
}
