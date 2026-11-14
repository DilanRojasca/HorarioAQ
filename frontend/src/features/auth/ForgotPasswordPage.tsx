import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../shared/api';
import { AuthShell, Button, ErrorNotice, Field, OtpField, PasswordField, SuccessNotice } from '../../shared/forms';
import { passwordProblem } from './registrationRules';

/** RF-AUTH-04 / RNF-07: recuperación en dos pasos con OTP de un solo uso (vigencia 10 min). */
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mail = email.trim().toLowerCase();
  const pwProblem = password ? passwordProblem(password) : null;

  async function request(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await api.post('/auth/password/forgot', { email: mail }); setStep('reset'); }
    catch (e2) { setError(e2 instanceof ApiError ? e2.message : 'No se pudo enviar el código'); }
    finally { setBusy(false); }
  }

  async function reset(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.post('/auth/password/reset', { email: mail, code, newPassword: password });
      navigate('/login?reset=1', { replace: true });
    } catch (e2) { setError(e2 instanceof ApiError ? e2.message : 'No se pudo restablecer la contraseña'); }
    finally { setBusy(false); }
  }

  return (
    <AuthShell title="Recuperar contraseña" subtitle={step === 'request' ? 'Te enviaremos un código a tu correo institucional' : 'Escribe el código y tu nueva contraseña'} icon="lock">
      {step === 'request' ? (
        <form onSubmit={request} noValidate className="space-y-4">
          <Field id="email" label="Correo institucional" type="email" icon="mail" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <ErrorNotice>{error}</ErrorNotice>}
          <Button type="submit" disabled={!/\S+@\S+\.\S+/.test(email)} loading={busy} loadingText="Enviando…">Enviar código</Button>
        </form>
      ) : (
        <form onSubmit={reset} noValidate className="space-y-4">
          <SuccessNotice>Si la cuenta existe, enviamos un código a {mail}.</SuccessNotice>
          <OtpField id="code" label="Código" value={code} onChange={setCode} />
          <PasswordField id="newPassword" label="Nueva contraseña" autoComplete="new-password" showStrength value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <ErrorNotice>{error}</ErrorNotice>}
          <Button type="submit" disabled={!/^\d{6}$/.test(code) || !password || !!pwProblem} loading={busy} loadingText="Guardando…">Cambiar contraseña</Button>
        </form>
      )}
      <p className="m-0 mt-4 text-center text-body-sm text-on-surface-variant"><Link to="/login" className="font-semibold text-primary underline">Volver a iniciar sesión</Link></p>
    </AuthShell>
  );
}
