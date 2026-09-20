import { Badge } from '@/components/ui/badge';

export function Navbar({ user }: { user: { username: string; email: string; role: string } }) {
  return (
    <header className="h-16 border-b border-white/5 bg-card/20 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 gap-3">
      <div className="signal-dot signal-dot--live hidden sm:flex items-center gap-2 text-signal-success">
        <span className="text-xs font-medium text-muted-foreground font-data">System nominal</span>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium leading-tight">{user.username}</p>
          <p className="text-xs text-muted-foreground leading-tight font-data">{user.email}</p>
        </div>
        <Badge status={user.role}>{user.role}</Badge>
      </div>
    </header>
  );
}
