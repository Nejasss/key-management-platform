'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';

interface LogRow {
  id: string;
  action: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  userEmail: string | null;
}

export default function LogsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/logs?page=${page}&pageSize=25`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setRows(d.data);
          setTotalPages(d.pagination.totalPages || 1);
        }
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Activity Logs</h1>
        <p className="text-sm text-muted-foreground">Audit trail of all system actions</p>
      </div>

      <Card>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-muted-foreground">
                <th className="p-3 font-medium">Timestamp</th>
                <th className="p-3 font-medium">Action</th>
                <th className="p-3 font-medium">User</th>
                <th className="p-3 font-medium">IP</th>
                <th className="p-3 font-medium">User Agent</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="p-3" colSpan={5}>
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))}
              {!loading &&
                rows.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 last:border-0 hover:bg-secondary/30">
                    <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDate(log.createdAt)}</td>
                    <td className="p-3 font-medium capitalize">{log.action.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-muted-foreground">{log.userEmail ?? '—'}</td>
                    <td className="p-3 text-muted-foreground font-data text-xs">{log.ip ?? '—'}</td>
                    <td className="p-3 text-muted-foreground text-xs max-w-[220px] truncate">{log.userAgent ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && <EmptyState title="No activity recorded yet" />}
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
    </div>
  );
}
