import { ChartColumn, CircleUser, LayoutDashboard, Presentation } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

const links = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/sessions', label: 'Sessions', icon: Presentation, end: false },
  { to: '/app/reports', label: 'Reports', icon: ChartColumn, end: false },
  { to: '/app/account', label: 'Account', icon: CircleUser, end: false },
];

export function DashboardShell() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="border-border bg-card border-b md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-5 py-4">
          <p className="font-serif text-2xl leading-none text-yellow-500">LiveQ</p>
          <ThemeToggle />
        </div>
        <nav
          className="flex gap-1 overflow-x-auto px-3 pb-3 md:grid md:px-3 md:pb-0"
          aria-label="Speaker"
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
                )
              }
            >
              <link.icon className="size-4" aria-hidden />
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-border hidden border-t px-5 py-5 md:block">
          <p className="truncate text-sm font-medium">
            {user?.displayName ?? 'Speaker'}
          </p>
          <p className="text-muted-foreground truncate text-xs">{user?.email}</p>
        </div>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
