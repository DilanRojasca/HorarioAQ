import { Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import NotificationBell from '../features/notifications/NotificationBell';

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface-container-lowest focus:px-4 focus:py-2 focus:text-primary"
      >
        Saltar al contenido
      </a>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between gap-3 border-b-4 border-secondary-container bg-primary-container px-4 md:px-margin-desktop">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-headline-md font-bold tracking-tight text-on-primary">Horario UNI</span>
            {user?.role === 'ADMIN' && (
              <span className="rounded border border-outline-variant/30 bg-primary px-1.5 py-0.5 text-label-sm uppercase text-on-primary">
                Admin
              </span>
            )}
          </div>
          <span className="truncate text-label-sm text-on-primary-container">U. Católica Luis Amigó</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {user?.name && <span className="hidden max-w-[16rem] truncate text-body-md text-on-primary sm:inline">{user.name}</span>}
          {user?.role === 'STUDENT' && <NotificationBell />}
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border border-outline-variant/30 bg-primary px-3 text-label-md font-semibold text-on-primary hover:bg-surface-tint focus-visible:ring-white focus-visible:ring-offset-primary-container"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">logout</span>
            <span className="sr-only sm:not-sr-only">Cerrar sesión</span>
          </button>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-xl px-3 pb-8 pt-20 md:max-w-5xl md:px-6">
        <Outlet />
      </main>
    </>
  );
}
