import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError } from '../../shared/api';
import { useAuth } from './AuthContext';

const fieldInput =
  'block w-full min-h-[44px] rounded-[10px] border border-outline-variant bg-surface-container-lowest pl-10 pr-3 text-body-md text-on-surface placeholder:text-outline focus:border-primary-container focus-visible:ring-2 focus-visible:ring-primary';

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/'} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(email, password); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión'); }
    finally { setBusy(false); }
  }

  const valid = /\S+@\S+\.\S+/.test(email) && password.length > 0;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center gap-3 border-b-4 border-secondary-container bg-primary-container px-4 md:px-margin-desktop">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-secondary-container" aria-hidden="true">
          <span className="material-symbols-outlined text-[22px]">school</span>
        </span>
        <div className="flex flex-col">
          <span className="text-headline-md font-bold tracking-tight text-on-primary">Horario UNI</span>
          <span className="text-label-sm text-on-primary-container">Universidad Católica Luis Amigó</span>
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-3 py-8">
        <div className="w-full max-w-[380px] rounded-[10px] border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_3px_rgba(27,42,51,0.04),0_1px_2px_rgba(27,42,51,0.02)]">
          <div className="mb-5 flex flex-col items-center text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-primary-container" aria-hidden="true">
              <span className="material-symbols-outlined text-[28px]">account_circle</span>
            </span>
            <h1 className="m-0 text-headline-md font-bold text-on-surface">Horario UNI</h1>
            <p className="mt-1 text-body-sm text-on-surface-variant">Inicia sesión para ver tu horario</p>
          </div>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-label-md font-semibold text-on-surface">Correo</label>
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline" aria-hidden="true">mail</span>
                <input
                  id="email" type="email" autoComplete="username" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className={fieldInput}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-label-md font-semibold text-on-surface">Contraseña</label>
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline" aria-hidden="true">lock</span>
                <input
                  id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className={`${fieldInput} pr-12`}
                />
                <button
                  type="button"
                  aria-label="Mostrar u ocultar contraseña"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-[10px] text-on-surface-variant hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex gap-2.5 rounded-[10px] border border-error/30 bg-error-container/40 p-3 text-error">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">error</span>
                <p className="m-0 text-body-md font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!valid || busy}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[10px] bg-primary-container font-semibold text-on-primary hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-primary-container"
            >
              {busy ? 'Entrando…' : 'Entrar'}
              {!busy && <span className="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_forward</span>}
            </button>
          </form>
        </div>
      </main>

      <footer className="px-4 pb-6 text-center text-body-sm text-on-surface-variant">
        Universidad Católica Luis Amigó · Sistema de Horarios Académicos
      </footer>
    </div>
  );
}
