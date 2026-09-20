import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { ToastProvider } from '@/components/ui/toaster';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Navbar } from '@/components/dashboard/navbar';
import { PageTransition } from '@/components/dashboard/page-transition';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar user={user} />
          <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
