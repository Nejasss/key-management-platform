'use client';

import * as React from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'error' | 'default';

interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (t: Omit<Toast, 'id'>) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[90vw] max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'glass relative flex items-start gap-3 rounded-2xl p-4 pl-4 animate-in slide-in-from-bottom-2 overflow-hidden',
              t.variant === 'success' && 'before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-signal-success',
              t.variant === 'error' && 'before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-signal-danger'
            )}
          >
            {t.variant === 'success' && <CheckCircle2 className="h-5 w-5 text-signal-success shrink-0" />}
            {t.variant === 'error' && <XCircle className="h-5 w-5 text-signal-danger shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
