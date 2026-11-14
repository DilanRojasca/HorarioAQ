import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../shared/api';
import { Button, ErrorNotice, Field, FormSection, Icon, PasswordField, SuccessNotice } from '../../shared/forms';
import { useAuth } from '../auth/AuthContext';
import { passwordProblem } from '../auth/registrationRules';
import { fileToAvatar } from './avatar';

interface Profile { name: string; email: string; documentType: string | null; documentNumber: string | null; avatarUrl: string | null }

/** RF-AUTH-06: editar nombre, foto y contraseña. El correo institucional y el documento son de solo lectura. */
export default function ProfilePage() {
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState('');
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<Profile>('/auth/me').then((p) => { setProfile(p); setName(p.name); }).catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar el perfil'));
  }, []);

  async function save(section: string, body: Record<string, unknown>, message: string) {
    setBusy(section); setError(''); setOk('');
    try {
      const p = await api.put<Profile>('/auth/me', body);
      setProfile(p); setName(p.name); setCurrent(''); setNext('');
      updateUser({ name: p.name, avatarUrl: p.avatarUrl });
      setOk(message);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar'); }
    finally { setBusy(''); }
  }

  async function onPhoto(f: File | undefined) {
    if (!f) return;
    try { await save('photo', { avatarUrl: await fileToAvatar(f) }, 'Foto actualizada.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo procesar la foto'); }
    if (file.current) file.current.value = '';
  }

  const pwProblem = next ? passwordProblem(next) : null;
  if (!profile) return error ? <ErrorNotice>{error}</ErrorNotice> : <p role="status" className="m-0 text-body-md text-on-surface-variant">Cargando perfil…</p>;
  const nameChanged = name.trim() !== profile.name && name.trim().split(/\s+/).length >= 2;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-center gap-4 rounded-[10px] border border-outline-variant bg-surface-container-lowest p-4">
        <div className="relative shrink-0">
          {profile.avatarUrl
            ? <img src={profile.avatarUrl} alt="Tu foto de perfil" className="h-20 w-20 rounded-full border border-outline-variant object-cover" />
            : <span className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-container text-primary-container" aria-hidden="true"><span className="material-symbols-outlined text-[48px]">account_circle</span></span>}
          <label
            htmlFor="photo" title="Cambiar foto"
            className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-surface-container-lowest bg-primary-container text-on-primary shadow hover:bg-primary has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/30"
          >
            <Icon name="photo_camera" className="text-[18px]" /><span className="sr-only">Cambiar foto</span>
            <input ref={file} id="photo" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => void onPhoto(e.target.files?.[0])} />
          </label>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 truncate text-headline-xl-mobile text-on-surface">{profile.name}</h1>
          <p className="m-0 truncate text-body-md text-on-surface-variant">{profile.email}</p>
          {profile.avatarUrl && (
            <button type="button" onClick={() => void save('photo', { avatarUrl: null }, 'Foto eliminada.')} className="mt-1 text-label-md font-semibold text-primary underline">Quitar foto</button>
          )}
        </div>
      </header>

      <div aria-live="polite" className="space-y-3 empty:hidden">
        {error && <ErrorNotice>{error}</ErrorNotice>}
        {ok && <SuccessNotice>{ok}</SuccessNotice>}
      </div>

      <FormSection id="data-title" title="Datos personales" icon="person" description="El correo institucional y el documento los define la universidad y no se pueden modificar.">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); void save('name', { name }, 'Nombre actualizado.'); }} className="space-y-4" noValidate>
          <Field id="name" label="Nombre completo" icon="person" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="email" label="Correo institucional" icon="mail" value={profile.email} readOnly />
            <Field id="doc" label="Documento" icon="badge" value={`${profile.documentType ?? ''} ${profile.documentNumber ?? ''}`.trim() || '—'} readOnly />
          </div>
          <Button type="submit" disabled={!nameChanged} loading={busy === 'name'} loadingText="Guardando…">Guardar nombre</Button>
        </form>
      </FormSection>

      <FormSection id="pw-title" title="Cambiar contraseña" icon="lock" description="Al cambiarla se cerrarán tus otras sesiones.">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); void save('pw', { currentPassword: current, newPassword: next }, 'Contraseña actualizada.'); }} className="space-y-4" noValidate>
          <PasswordField id="current" label="Contraseña actual" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          <PasswordField id="next" label="Nueva contraseña" autoComplete="new-password" showStrength value={next} onChange={(e) => setNext(e.target.value)} />
          <Button type="submit" disabled={!current || !next || !!pwProblem} loading={busy === 'pw'} loadingText="Guardando…">Cambiar contraseña</Button>
        </form>
      </FormSection>
    </div>
  );
}
