import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../shared/api';
import { AuthShell, Button, ErrorNotice, Field, PasswordField, SuccessNotice } from '../../shared/forms';
import { useAuth } from './AuthContext';

export default function LoginPage() {
  const { user, login } = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <AuthShell title="Horario UNI" subtitle="Inicia sesión para ver tu horario">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field id="email" label="Correo" type="email" icon="mail" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField id="password" label="Contraseña" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {!error && params.get('verified') && <SuccessNotice>Cuenta verificada. Ya puedes iniciar sesión.</SuccessNotice>}
        {!error && params.get('reset') && <SuccessNotice>Contraseña actualizada. Inicia sesión con la nueva.</SuccessNotice>}
        {error && <ErrorNotice>{error}</ErrorNotice>}
        <Button type="submit" disabled={!valid} loading={busy} loadingText="Entrando…" icon="arrow_forward">Entrar</Button>
      </form>
      <div className="mt-5 flex flex-col items-center gap-1.5 border-t border-outline-variant/60 pt-4 text-body-sm text-on-surface-variant">
        <Link to="/forgot" className="font-semibold text-primary underline">¿Olvidaste tu contraseña?</Link>
        <span>¿Sin cuenta? <Link to="/register" className="font-semibold text-primary underline">Regístrate</Link></span>
      </div>
    </AuthShell>
  );
}
