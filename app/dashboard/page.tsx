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
import { formatDate } from '@/lib/utils';
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

const STAT_CARDS = [
  { key: 'totalKeys', label: 'Total Keys', icon: KeyRound, color: 'text-primary' },
  { key: 'activeKeys', label: 'Active Keys', icon: ShieldCheck, color: 'text-success' },
  { key: 'expiredKeys', label: 'Expired Keys', icon: ShieldAlert, color: 'text-warning' },
  { key: 'revokedKeys', label: 'Revoked Keys', icon: ShieldX, color: 'text-destructive' },
  { key: 'usedDevices', label: 'Used Devices', icon: Smartphone, color: 'text-primary' },
  { key: 'totalUsers', label: 'Total Users', icon: Users, color: 'text-primary' },
  { key: 'keysToday', label: 'Keys Generated Today', icon: TrendingUp, color: 'text-success' },
  { key: 'verificationsToday', label: 'Verifications Today', icon: Activity, color: 'text-primary' },
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
        { name: 'Active', value: stats.activeKeys, color: '#22c55e' },
        { name: 'Expired', value: stats.expiredKeys, color: '#f59e0b' },
        { name: 'Revoked', value: stats.revokedKeys, color: '#ef4444' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your license key system</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.key}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg bg-secondary flex items-center justify-center ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                  {loading ? (
                    <Skeleton className="h-5 w-10 mt-1" />
                  ) : (
                    <p className="text-lg font-semibold">{stats?.[card.key] ?? 0}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Key Generation & Verification (14 days)</CardTitle>
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
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="generated" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Generated" />
                  <Line type="monotone" dataKey="verified" stroke="#22c55e" strokeWidth={2} dot={false} name="Verified" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active vs Expired vs Revoked</CardTitle>
          </CardHeader>
          <CardContent className="h-72 flex items-center justify-center">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={4}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
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
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          {!loading && stats?.recentActivity.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No activity yet.</p>
          )}
          {!loading &&
            stats?.recentActivity.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                <div>
                  <span className="font-medium capitalize">{log.action.replace(/_/g, ' ')}</span>
                  {log.userEmail && <span className="text-muted-foreground"> · {log.userEmail}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
