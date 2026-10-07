import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError } from '../../shared/api';
import { useAuth } from './AuthContext';

export default function LoginPage() {
  const { user, login } = useAuth();
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
    <main className="container" style={{ maxWidth: 420 }}>
      <h1>Horario UNI</h1>
      <p className="muted">Inicia sesión para ver tu horario.</p>
      <form className="card" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">Correo</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="btn" type="submit" disabled={!valid || busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  );
}
