'use client';

import { useEffect, useState } from 'react';
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Smartphone,
  Users,
  TrendingUp,
  Activity,
} from 'lucide-react';
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

// Each metric gets its own hue — variety on purpose, kept soft rather
// than saturated, so the dashboard doesn't read as one flat color.
const READOUTS = [
  { key: 'totalKeys', label: 'Total keys', icon: KeyRound, text: 'text-primary', chip: 'bg-primary/10' },
  { key: 'activeKeys', label: 'Active', icon: ShieldCheck, text: 'text-signal-success', chip: 'bg-signal-success/10' },
  { key: 'expiredKeys', label: 'Expired', icon: ShieldAlert, text: 'text-signal-warning', chip: 'bg-signal-warning/10' },
  { key: 'revokedKeys', label: 'Revoked', icon: ShieldX, text: 'text-signal-danger', chip: 'bg-signal-danger/10' },
  { key: 'usedDevices', label: 'Devices bound', icon: Smartphone, text: 'text-signal-info', chip: 'bg-signal-info/10' },
  { key: 'totalUsers', label: 'Users', icon: Users, text: 'text-signal-violet', chip: 'bg-signal-violet/10' },
  { key: 'keysToday', label: 'Generated today', icon: TrendingUp, text: 'text-signal-teal', chip: 'bg-signal-teal/10' },
  { key: 'verificationsToday', label: 'Verified today', icon: Activity, text: 'text-signal-pink', chip: 'bg-signal-pink/10' },
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {READOUTS.map((r) => {
          const Icon = r.icon;
          return (
            <Card key={r.key} className="p-4 flex items-center gap-3">
              <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', r.chip, r.text)}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{r.label}</p>
                {loading ? (
                  <Skeleton className="h-6 w-12 mt-1" />
                ) : (
                  <p className="font-data text-xl font-medium mt-0.5">{stats?.[r.key] ?? 0}</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

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
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="generated" stroke="hsl(var(--signal-teal))" strokeWidth={2.5} dot={false} name="Generated" />
                  <Line type="monotone" dataKey="verified" stroke="hsl(var(--signal-pink))" strokeWidth={2.5} dot={false} name="Verified" />
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
                      borderRadius: 10,
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
        <CardContent className="space-y-0 divide-y divide-white/5">
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
