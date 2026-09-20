import { Badge } from '@/components/ui/badge';

export function Navbar({ user }: { user: { username: string; email: string; role: string } }) {
  return (
    <header className="h-16 border-b border-border flex items-center justify-end px-4 md:px-6 gap-3">
      <div className="text-right hidden sm:block">
        <p className="text-sm font-medium leading-tight">{user.username}</p>
        <p className="text-xs text-muted-foreground leading-tight">{user.email}</p>
      </div>
      <Badge status={user.role}>{user.role}</Badge>
    </header>
  );
}
