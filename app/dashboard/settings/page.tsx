'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toaster';

interface Settings {
  siteName: string;
  keyPrefix: string;
  defaultExpiryDays: number;
  defaultDeviceLimit: number;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setSettings(d.data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      toast({ title: 'Settings saved', variant: 'success' });
    } else {
      toast({ title: 'Failed to save', description: data.message, variant: 'error' });
    }
  }

  if (loading || !settings) {
    return <p className="text-sm text-muted-foreground">Loading settings...</p>;
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Global platform configuration</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="siteName">Site name</Label>
              <Input
                id="siteName"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keyPrefix">Default key prefix</Label>
              <Input
                id="keyPrefix"
                value={settings.keyPrefix}
                onChange={(e) => setSettings({ ...settings, keyPrefix: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultExpiryDays">Default expiry (days)</Label>
              <Input
                id="defaultExpiryDays"
                type="number"
                min={0}
                value={settings.defaultExpiryDays}
                onChange={(e) => setSettings({ ...settings, defaultExpiryDays: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultDeviceLimit">Default device limit (-1 = unlimited)</Label>
              <Input
                id="defaultDeviceLimit"
                type="number"
                min={-1}
                value={settings.defaultDeviceLimit}
                onChange={(e) => setSettings({ ...settings, defaultDeviceLimit: Number(e.target.value) })}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Session, API rate-limit, and admin credential configuration are managed via environment
        variables (see <code>.env.example</code>) for security — they are not editable from the UI.
      </p>
    </div>
  );
}
