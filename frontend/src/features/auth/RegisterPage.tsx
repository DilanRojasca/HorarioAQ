import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../shared/api';
import { AuthShell, Button, ErrorNotice, Field, PasswordField, SelectField } from '../../shared/forms';
import { useAuth } from './AuthContext';
import { DOCUMENT_TYPES, INSTITUTIONAL_DOMAIN, validateRegistration } from './registrationRules';
import type { RegistrationData } from './registrationRules';

/** RF-AUTH-01: registro con validación en tiempo real; el botón solo se habilita con datos válidos. */
export default function RegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<RegistrationData>({ name: '', documentType: 'CC', documentNumber: '', email: '', password: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const errors = useMemo(() => validateRegistration(data), [data]);
  const valid = Object.keys(errors).length === 0;

  if (user) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/'} replace />;

  const set = (k: keyof RegistrationData) => (e: { target: { value: string } }) => setData((d) => ({ ...d, [k]: e.target.value }));
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
  const err = (k: keyof RegistrationData) => (touched[k] ? errors[k] : undefined);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true); setError('');
    try {
      await api.post('/auth/register', { ...data, email: data.email.trim().toLowerCase() });
      navigate(`/verify?email=${encodeURIComponent(data.email.trim().toLowerCase())}`, { replace: true });
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : 'No se pudo crear la cuenta');
    } finally { setBusy(false); }
  }

  return (
    <AuthShell title="Crear cuenta" subtitle="Usa tu correo institucional para registrarte" icon="person">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field id="name" label="Nombre completo" icon="person" autoComplete="name" value={data.name} onChange={set('name')} onBlur={blur('name')} error={err('name')} valid={!errors.name} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr]">
          <SelectField id="documentType" label="Tipo de documento" value={data.documentType} onChange={set('documentType')}>
            {DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </SelectField>
          <Field id="documentNumber" label="Número de documento" icon="badge" inputMode="text" value={data.documentNumber} onChange={set('documentNumber')} onBlur={blur('documentNumber')} error={err('documentNumber')} valid={!errors.documentNumber} />
        </div>
        <Field
          id="email" label="Correo institucional" type="email" icon="mail" autoComplete="email" placeholder={`nombre${INSTITUTIONAL_DOMAIN}`}
          value={data.email} onChange={set('email')} onBlur={blur('email')} error={err('email')} valid={!errors.email}
        />
        <PasswordField id="password" label="Contraseña" autoComplete="new-password" showStrength value={data.password} onChange={set('password')} onBlur={blur('password')} />
        {error && <ErrorNotice>{error}</ErrorNotice>}
        <Button type="submit" disabled={!valid} loading={busy} loadingText="Creando cuenta…">Crear cuenta</Button>
        <p className="m-0 text-center text-body-sm text-on-surface-variant">
          ¿Ya tienes cuenta? <Link to="/login" className="font-semibold text-primary underline">Inicia sesión</Link>
        </p>
      </form>
    </AuthShell>
  );
}
