'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Copy, Eye, Ban, Trash2, RotateCcw, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toaster';
import { formatDate, cn } from '@/lib/utils';
import { KeyDetailDialog } from '@/components/dashboard/key-detail-dialog';

interface LicenseRow {
  id: string;
  key: string;
  status: string;
  prefix: string;
  maxDevices: number;
  deviceCount: number;
  expiresAt: string | null;
  createdAt: string;
  lastVerifiedAt: string | null;
  note: string | null;
}

export default function KeysPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<LicenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: '20', status, search });
    const res = await fetch(`/api/licenses?${params}`);
    const data = await res.json();
    if (data.success) {
      setRows(data.data);
      setTotalPages(data.pagination.totalPages || 1);
    }
    setLoading(false);
  }, [page, status, search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function handleAction(id: string, action: 'revoke' | 'reset-device' | 'delete') {
    if (action === 'delete' && !confirm('Delete this license key permanently?')) return;

    const res = await fetch(
      action === 'delete' ? `/api/licenses/${id}` : `/api/licenses/${id}/${action}`,
      { method: action === 'delete' ? 'DELETE' : 'POST' }
    );
    const data = await res.json();
    if (data.success) {
      toast({ title: 'Success', description: data.message, variant: 'success' });
      load();
    } else {
      toast({ title: 'Error', description: data.message, variant: 'error' });
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    toast({ title: 'Copied', description: key, variant: 'success' });
  }

  function openDetail(id: string) {
    setDetailId(id);
    setDetailOpen(true);
  }

  function exportCsv() {
    const header = 'key,status,prefix,max_devices,expires_at,created_at,note\n';
    const body = rows
      .map((r) => [r.key, r.status, r.prefix, r.maxDevices, r.expiresAt ?? '', r.createdAt, r.note ?? ''].join(','))
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `licenses-page-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">License Keys</h1>
          <p className="text-sm text-muted-foreground">Manage, search, and monitor all license keys</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search key or note..."
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              className="pl-9"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className="h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="unused">Unused</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-muted-foreground">
                <th className="p-3 font-medium">Key</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Created</th>
                <th className="p-3 font-medium">Expiry</th>
                <th className="p-3 font-medium">Devices</th>
                <th className="p-3 font-medium">Last Verified</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="p-3" colSpan={7}>
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))}
              {!loading &&
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-white/5 last:border-0 hover:bg-secondary/30">
                    <td className="p-3 font-data text-xs whitespace-nowrap">
                      <button onClick={() => copyKey(row.key)} className="flex items-center gap-1.5 hover:text-primary">
                        {row.key} <Copy className="h-3 w-3" />
                      </button>
                    </td>
                    <td className="p-3">
                      <Badge status={row.status}>{row.status}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap font-data text-xs">{formatDate(row.createdAt)}</td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap font-data text-xs">{formatDate(row.expiresAt)}</td>
                    <td className="p-3">
                      <button
                        onClick={() => openDetail(row.id)}
                        className={cn(
                          'text-xs font-medium hover:text-primary hover:underline underline-offset-2',
                          row.maxDevices !== -1 && row.deviceCount >= row.maxDevices && 'text-warning'
                        )}
                        title="View bound devices"
                      >
                        {row.deviceCount} / {row.maxDevices === -1 ? '∞' : row.maxDevices}
                      </button>
                    </td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap font-data text-xs">{formatDate(row.lastVerifiedAt)}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" title="View devices" onClick={() => openDetail(row.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Reset all devices" onClick={() => handleAction(row.id, 'reset-device')}>
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Revoke"
                          disabled={row.status === 'revoked'}
                          onClick={() => handleAction(row.id, 'revoke')}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete" onClick={() => handleAction(row.id, 'delete')}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && (
            <EmptyState title="No license keys found" description="Try adjusting your search or filters, or generate a new key." />
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <KeyDetailDialog
        licenseId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onChanged={load}
      />
    </div>
  );
}
