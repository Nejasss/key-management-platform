'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, cn } from '@/lib/utils';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface Stats {
  totalKeys: number;
  activeKeys: number;
  expiredKeys: number;
  revokedKeys: number;
  usedDevices: number;
  totalUsers: number;
  keysToday: number;
  verificationsToday: number;
  recentActivity: { id: string; action: string; createdAt: string; userEmail: string | null }[];
  dailyGeneration: { date: string; count: number }[];
  dailyVerifications: { date: string; count: number }[];
}

const READOUTS = [
  { key: 'totalKeys', label: 'total keys', tone: 'text-foreground' },
  { key: 'activeKeys', label: 'active', tone: 'text-signal-success' },
  { key: 'expiredKeys', label: 'expired', tone: 'text-signal-warning' },
  { key: 'revokedKeys', label: 'revoked', tone: 'text-signal-danger' },
  { key: 'usedDevices', label: 'devices bound', tone: 'text-foreground' },
  { key: 'totalUsers', label: 'users', tone: 'text-foreground' },
  { key: 'keysToday', label: 'generated today', tone: 'text-primary' },
  { key: 'verificationsToday', label: 'verified today', tone: 'text-primary' },
] as const;

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setStats(d.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const pieData = stats
    ? [
        { name: 'Active', value: stats.activeKeys, color: 'hsl(var(--signal-success))' },
        { name: 'Expired', value: stats.expiredKeys, color: 'hsl(var(--signal-warning))' },
        { name: 'Revoked', value: stats.revokedKeys, color: 'hsl(var(--signal-danger))' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your license key system</p>
      </div>

      {/* Readout strip — one bordered panel, hairline-divided cells,
          mono numerals. Replaces a grid of identical icon cards. */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-x divide-y divide-border lg:divide-y-0">
          {READOUTS.map((r) => (
            <div key={r.key} className="p-4">
              <p className="text-xs text-muted-foreground">{r.label}</p>
              {loading ? (
                <Skeleton className="h-6 w-12 mt-1.5" />
              ) : (
                <p className={cn('font-data text-2xl font-medium mt-0.5', r.tone)}>
                  {stats?.[r.key] ?? 0}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Key generation & verification — 14 days</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.dailyGeneration.map((d, i) => ({
                  date: d.date.slice(5),
                  generated: d.count,
                  verified: stats.dailyVerifications[i]?.count ?? 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="generated" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Generated" />
                  <Line type="monotone" dataKey="verified" stroke="hsl(var(--signal-success))" strokeWidth={2} dot={false} name="Verified" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active / expired / revoked</CardTitle>
          </CardHeader>
          <CardContent className="h-72 flex items-center justify-center">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="hsl(var(--card))" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 divide-y divide-border">
          {loading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full my-2" />)}
          {!loading && stats?.recentActivity.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No activity yet.</p>
          )}
          {!loading &&
            stats?.recentActivity.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-sm py-2.5">
                <div>
                  <span className="font-medium capitalize">{log.action.replace(/_/g, ' ')}</span>
                  {log.userEmail && <span className="text-muted-foreground font-data text-xs"> · {log.userEmail}</span>}
                </div>
                <span className="text-xs text-muted-foreground font-data">{formatDate(log.createdAt)}</span>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
