import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../shared/api';
import { AuthShell, Button, ErrorNotice, Field, OtpField, SuccessNotice } from '../../shared/forms';

/** RF-AUTH-05: la cuenta queda inactiva hasta confirmar el OTP enviado al correo institucional. */
export default function VerifyPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = /\S+@\S+\.\S+/.test(email) && /^\d{6}$/.test(code);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(''); setInfo('');
    try {
      await api.post('/auth/verify', { email: email.trim().toLowerCase(), code });
      navigate('/login?verified=1', { replace: true });
    } catch (e2) { setError(e2 instanceof ApiError ? e2.message : 'No se pudo verificar la cuenta'); }
    finally { setBusy(false); }
  }

  async function resend() {
    setError(''); setInfo('');
    try {
      await api.post('/auth/verify/resend', { email: email.trim().toLowerCase() });
      setInfo('Si la cuenta existe y está pendiente, te enviamos un código nuevo.');
    } catch (e2) { setError(e2 instanceof ApiError ? e2.message : 'No se pudo reenviar el código'); }
  }

  return (
    <AuthShell title="Verifica tu cuenta" subtitle="Escribe el código de 6 dígitos que enviamos a tu correo" icon="mark_email_read">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field id="email" label="Correo institucional" type="email" icon="mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <OtpField id="code" label="Código de verificación" value={code} onChange={setCode} hint="Vence a los 10 minutos y es de un solo uso." />
        {error && <ErrorNotice>{error}</ErrorNotice>}
        {info && <SuccessNotice>{info}</SuccessNotice>}
        <Button type="submit" disabled={!valid} loading={busy} loadingText="Verificando…">Verificar cuenta</Button>
        <Button variant="secondary" className="w-full" onClick={resend} disabled={!/\S+@\S+\.\S+/.test(email)} icon="refresh">Reenviar código</Button>
        <p className="m-0 text-center text-body-sm text-on-surface-variant"><Link to="/login" className="font-semibold text-primary underline">Volver a iniciar sesión</Link></p>
      </form>
    </AuthShell>
  );
}
