'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';

interface UserRow {
  id: string;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setRows(d.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">Accounts with access to the platform</p>
      </div>

      <Card>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-muted-foreground">
                <th className="p-3 font-medium">Username</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Role</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Created</th>
                <th className="p-3 font-medium">Last login</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="p-3" colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))}
              {!loading &&
                rows.map((u) => (
                  <tr key={u.id} className="stagger-row border-b border-white/5 last:border-0 hover:bg-secondary/30">
                    <td className="p-3 font-medium">{u.username}</td>
                    <td className="p-3 text-muted-foreground font-data text-xs">{u.email}</td>
                    <td className="p-3">
                      <Badge status={u.role}>{u.role}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge status={u.isActive ? 'active' : 'revoked'}>{u.isActive ? 'active' : 'disabled'}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap font-data text-xs">{formatDate(u.createdAt)}</td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap font-data text-xs">{formatDate(u.lastLoginAt)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && <EmptyState title="No users found" />}
        </div>
      </Card>
    </div>
  );
}
