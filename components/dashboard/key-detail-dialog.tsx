'use client';

import { useEffect, useState } from 'react';
import { Smartphone, Trash2, Copy, Loader2, Globe, Monitor, CalendarPlus, CalendarClock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toaster';
import { formatDate, cn } from '@/lib/utils';

const QUICK_EXTEND_DAYS = [7, 30, 90, 365];

interface Device {
  id: string;
  deviceId: string;
  ip: string | null;
  userAgent: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface LicenseDetail {
  id: string;
  key: string;
  status: string;
  maxDevices: number;
  expiresAt: string | null;
  createdAt: string;
  lastVerifiedAt: string | null;
  note: string | null;
  devices: Device[];
}

export function KeyDetailDialog({
  licenseId,
  open,
  onOpenChange,
  onChanged,
}: {
  licenseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const [data, setData] = useState<LicenseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [customDays, setCustomDays] = useState('');
  const [extending, setExtending] = useState(false);

  useEffect(() => {
    if (!open || !licenseId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/licenses/${licenseId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d.data);
      })
      .finally(() => setLoading(false));
  }, [open, licenseId]);

  async function removeDevice(device: Device) {
    if (!licenseId) return;
    setRemovingId(device.id);
    try {
      const res = await fetch(
        `/api/licenses/${licenseId}/devices/${encodeURIComponent(device.deviceId)}`,
        { method: 'DELETE' }
      );
      const result = await res.json();
      if (result.success) {
        setData((prev) => (prev ? { ...prev, devices: prev.devices.filter((d) => d.id !== device.id) } : prev));
        toast({ title: 'Device unbound', description: device.deviceId, variant: 'success' });
        onChanged?.();
      } else {
        toast({ title: 'Failed to unbind device', description: result.message, variant: 'error' });
      }
    } finally {
      setRemovingId(null);
    }
  }

  function copyDeviceId(id: string) {
    navigator.clipboard.writeText(id);
    toast({ title: 'Device ID copied', variant: 'success' });
  }

  async function extendLicense(days: number) {
    if (!licenseId || !data || days < 1) return;
    setExtending(true);
    try {
      const res = await fetch(`/api/licenses/${licenseId}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      });
      const result = await res.json();
      if (result.success) {
        setData((prev) => (prev ? { ...prev, expiresAt: result.data.expiresAt, status: result.data.status } : prev));
        setCustomDays('');
        toast({ title: 'License extended', description: result.message, variant: 'success' });
        onChanged?.();
      } else {
        toast({ title: 'Failed to extend', description: result.message, variant: 'error' });
      }
    } finally {
      setExtending(false);
    }
  }

  const slotsUsed = data?.devices.length ?? 0;
  const slotsLabel = data ? (data.maxDevices === -1 ? `${slotsUsed} / unlimited` : `${slotsUsed} / ${data.maxDevices}`) : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-data text-sm break-all pr-6">
            {loading || !data ? 'Loading key...' : data.key}
          </DialogTitle>
          <DialogDescription>
            Devices currently bound to this license, and how many device slots are in use.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}

          {!loading && data && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge status={data.status}>{data.status}</Badge>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs font-medium font-data">
                  <Smartphone className="h-3 w-3" />
                  {slotsLabel} devices used
                </span>
                {data.expiresAt && (
                  <span className="text-xs text-muted-foreground font-data">Expires {formatDate(data.expiresAt)}</span>
                )}
              </div>

              {data.status === 'revoked' ? (
                <div className="rounded-xl bg-signal-danger/10 border border-signal-danger/20 p-3 text-xs text-signal-danger">
                  This license is revoked. Reactivate it from the Keys table before extending its expiry.
                </div>
              ) : (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-3">
                  <p className="text-xs font-medium text-foreground inline-flex items-center gap-1.5">
                    <CalendarPlus className="h-3.5 w-3.5 text-signal-teal" /> Extend license
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_EXTEND_DAYS.map((d) => (
                      <Button
                        key={d}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={extending}
                        onClick={() => extendLicense(d)}
                        className="h-8 px-3 text-xs"
                      >
                        +{d}d
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={3650}
                      placeholder="Custom days"
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                      className="h-9 w-32 text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={extending || !customDays || Number(customDays) < 1}
                      onClick={() => extendLicense(Number(customDays))}
                      className="h-9"
                    >
                      {extending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
                      Extend
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Adds on top of the current expiry if it hasn&apos;t passed yet, or starts fresh from today if it has.
                  </p>
                </div>
              )}

              {data.devices.length === 0 ? (
                <EmptyState
                  icon={Smartphone}
                  title="No devices bound yet"
                  description="This key hasn't been activated on any device — it will bind automatically on first verification."
                />
              ) : (
                <div className="space-y-2">
                  {data.devices.map((device) => (
                    <div
                      key={device.id}
                      className="rounded-xl border border-white/5 bg-white/[0.02] p-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <button
                          onClick={() => copyDeviceId(device.deviceId)}
                          className="flex items-center gap-1.5 font-data text-xs hover:text-primary break-all text-left"
                          title="Copy device ID"
                        >
                          {device.deviceId}
                          <Copy className="h-3 w-3 shrink-0" />
                        </button>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Globe className="h-3 w-3" /> {device.ip ?? 'unknown IP'}
                          </span>
                          {device.userAgent && (
                            <span className="inline-flex items-center gap-1 max-w-[220px] truncate">
                              <Monitor className="h-3 w-3 shrink-0" /> {device.userAgent}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>First seen {formatDate(device.firstSeenAt)}</span>
                          <span>Last seen {formatDate(device.lastSeenAt)}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Unbind this device"
                        disabled={removingId === device.id}
                        onClick={() => removeDevice(device)}
                        className="shrink-0"
                      >
                        {removingId === device.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className={cn('h-4 w-4 text-destructive')} />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {data.note && (
                <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Note: </span>
                  {data.note}
                </div>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
