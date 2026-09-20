'use client';

import { useEffect, useState } from 'react';
import { Smartphone, Trash2, Copy, Loader2, Globe, Monitor } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toaster';
import { formatDate, cn } from '@/lib/utils';

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
                  <span className="text-xs text-muted-foreground">Expires {formatDate(data.expiresAt)}</span>
                )}
              </div>

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
