'use client';

import { useState } from 'react';
import { Loader2, Copy, Download, KeyRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toaster';

interface GeneratedKey {
  id: string;
  key: string;
  status: string;
  expiresAt: string | null;
  maxDevices: number;
}

export default function GenerateKeyPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    prefix: 'KMP',
    quantity: 1,
    segments: 3,
    segmentLength: 6,
    expiryDays: 30,
    maxDevices: 1,
    note: '',
    autoActivate: true,
  });
  const [generated, setGenerated] = useState<GeneratedKey[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) {
        toast({ title: 'Failed to generate', description: data.message, variant: 'error' });
        return;
      }
      setGenerated(data.data);
      toast({ title: 'Keys generated', description: `${data.data.length} key(s) created successfully`, variant: 'success' });
    } catch {
      toast({ title: 'Network error', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function copyAll() {
    navigator.clipboard.writeText(generated.map((g) => g.key).join('\n'));
    toast({ title: 'Copied all keys to clipboard', variant: 'success' });
  }

  function download(format: 'csv' | 'txt') {
    let content: string;
    let mime: string;
    if (format === 'csv') {
      content = 'key,status,expires_at,max_devices\n' + generated.map((g) => `${g.key},${g.status},${g.expiresAt ?? ''},${g.maxDevices}`).join('\n');
      mime = 'text/csv';
    } else {
      content = generated.map((g) => g.key).join('\n');
      mime = 'text/plain';
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated-keys.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Generate License Key</h1>
        <p className="text-sm text-muted-foreground">Create a single key or bulk-generate many at once</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prefix">Prefix</Label>
              <Input id="prefix" value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={1000}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="segments">Segments</Label>
              <Input
                id="segments"
                type="number"
                min={1}
                max={6}
                value={form.segments}
                onChange={(e) => setForm({ ...form, segments: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="segmentLength">Segment length</Label>
              <Input
                id="segmentLength"
                type="number"
                min={4}
                max={12}
                value={form.segmentLength}
                onChange={(e) => setForm({ ...form, segmentLength: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiryDays">Expiry (days, 0 = never)</Label>
              <Input
                id="expiryDays"
                type="number"
                min={0}
                value={form.expiryDays}
                onChange={(e) => setForm({ ...form, expiryDays: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxDevices">Max devices (-1 = unlimited)</Label>
              <Input
                id="maxDevices"
                type="number"
                min={-1}
                value={form.maxDevices}
                onChange={(e) => setForm({ ...form, maxDevices: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="note">Custom note (optional)</Label>
              <Input id="note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="autoActivate"
                type="checkbox"
                checked={form.autoActivate}
                onChange={(e) => setForm({ ...form, autoActivate: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="autoActivate" className="font-normal">
                Auto-activate keys immediately
              </Label>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {loading ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {generated.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Generated Keys ({generated.length})</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyAll}>
                <Copy className="h-4 w-4" /> Copy all
              </Button>
              <Button variant="outline" size="sm" onClick={() => download('csv')}>
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => download('txt')}>
                <Download className="h-4 w-4" /> TXT
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-y-auto scrollbar-thin rounded-md border border-border">
              <table className="w-full text-sm">
                <tbody>
                  {generated.map((g) => (
                    <tr key={g.id} className="border-b border-border last:border-0">
                      <td className="p-2 font-mono text-xs">{g.key}</td>
                      <td className="p-2 text-muted-foreground text-xs">{g.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
