import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../shared/api';
import { card } from '../../shared/ui';
import { Button, ErrorNotice, Field, FormSection, OptionCards, SelectField, SuccessNotice, TextAreaField } from '../../shared/forms';
import type { WeeklyResult } from '../schedule/types';
import { cancelScheduled, createScheduled, getPreferences, listNotifications, listScheduled, savePreferences } from './api';
import type { AppNotification, NotifyChannel, ScheduledNotification } from './api';
import { relativeTime } from './relativeTime';

const CHANNELS = [
  { value: 'BOTH' as NotifyChannel, label: 'App y correo', hint: 'Aviso en pantalla y correo.', icon: 'notifications_active' },
  { value: 'IN_APP' as NotifyChannel, label: 'Solo en la app', hint: 'No recibirás correos.', icon: 'notifications' },
  { value: 'EMAIL' as NotifyChannel, label: 'Solo correo', hint: 'Sin avisos emergentes.', icon: 'mail' },
];
const REMINDER_OPTIONS = [5, 10, 15, 30, 60];

/** Valor para `datetime-local` de «ahora + N minutos», en hora local del navegador. */
const inFuture = (minutes: number) => {
  const d = new Date(Date.now() + minutes * 60_000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset(), 0, 0);
  return d.toISOString().slice(0, 16);
};
const defaultFireAt = () => inFuture(60);
const QUICK_TIMES = [{ label: 'En 1 hora', minutes: 60 }, { label: 'En 3 horas', minutes: 180 }, { label: 'Mañana', minutes: 24 * 60 }];

/** RF-NOT-01 (notificaciones propias), RF-NOT-02 (antelación del recordatorio) y RF-NOT-04 (canal preferido). */
export default function NotificationsPage() {
  const [channel, setChannel] = useState<NotifyChannel>('BOTH');
  const [minutes, setMinutes] = useState(15);
  const [prefsMsg, setPrefsMsg] = useState('');
  const [scheduled, setScheduled] = useState<ScheduledNotification[]>([]);
  const [history, setHistory] = useState<AppNotification[]>([]);
  const [classes, setClasses] = useState<WeeklyResult['sessions']>([]);
  const [form, setForm] = useState({ title: '', message: '', fireAt: defaultFireAt(), sessionExternalId: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [prefs, sched, hist, week] = await Promise.all([
        getPreferences(), listScheduled(), listNotifications({ limit: 20 }), api.get<WeeklyResult>('/schedule/me'),
      ]);
      setChannel(prefs.notifyChannel); setMinutes(prefs.reminderMinutes);
      setScheduled(sched); setHistory(hist.items); setClasses(week.sessions);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la información'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function savePrefs(next: { notifyChannel?: NotifyChannel; reminderMinutes?: number }) {
    setError(''); setPrefsMsg('');
    try {
      const p = await savePreferences(next);
      setChannel(p.notifyChannel); setMinutes(p.reminderMinutes);
      setPrefsMsg('Preferencias guardadas.');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron guardar las preferencias'); }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(''); setOk('');
    try {
      setScheduled(await createScheduled({
        title: form.title, message: form.message, fireAt: new Date(form.fireAt).toISOString(),
        sessionExternalId: form.sessionExternalId || undefined,
      }));
      setForm({ title: '', message: '', fireAt: defaultFireAt(), sessionExternalId: '' });
      setOk('Notificación programada.');
    } catch (e2) { setError(e2 instanceof Error ? e2.message : 'No se pudo programar la notificación'); }
    finally { setBusy(false); }
  }

  const canCreate = form.title.trim() && form.message.trim() && form.fireAt;
  return (
    <div className="space-y-5">
      <header>
        <h1 className="m-0 text-headline-xl-mobile text-on-surface">Notificaciones</h1>
        <p className="mb-0 mt-1 text-body-md text-on-surface-variant">Recordatorios de clase, avisos propios y cómo quieres recibirlos.</p>
      </header>
      {error && <ErrorNotice>{error}</ErrorNotice>}

      <FormSection id="prefs-title" title="Preferencias" icon="tune" description="Nunca enviamos avisos fuera del rango de 6:00 a. m. a 10:00 p. m.">
        <OptionCards legend="Canal preferido" name="channel" value={channel} options={CHANNELS} onChange={(v) => void savePrefs({ notifyChannel: v })} />
        <div className="sm:w-64">
          <SelectField id="lead" label="Recordatorio antes de cada clase" value={minutes} onChange={(e) => void savePrefs({ reminderMinutes: Number(e.target.value) })}>
            {REMINDER_OPTIONS.map((m) => <option key={m} value={m}>{m} minutos</option>)}
          </SelectField>
        </div>
        <div role="status" aria-live="polite" className="empty:hidden">{prefsMsg && <p className="m-0 flex items-center gap-1.5 text-body-sm text-[#1E7E34]"><span className="material-symbols-outlined text-[16px]" aria-hidden="true">check_circle</span>{prefsMsg}</p>}</div>
      </FormSection>

      <FormSection id="new-title" title="Programar una notificación" icon="alarm" description="Te avisaremos a la hora que elijas, por tu canal preferido.">
        <form onSubmit={create} className="space-y-4">
          <Field id="n-title" label="Título" maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextAreaField id="n-message" label="Mensaje" maxLength={300} rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Field id="n-when" label="Fecha y hora" type="datetime-local" value={form.fireAt} onChange={(e) => setForm({ ...form, fireAt: e.target.value })} />
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Atajos de hora">
                {QUICK_TIMES.map((q) => (
                  <button key={q.label} type="button" onClick={() => setForm({ ...form, fireAt: inFuture(q.minutes) })} className="min-h-[32px] rounded-full border border-outline-variant px-3 text-label-sm font-semibold text-primary hover:bg-surface-container">{q.label}</button>
                ))}
              </div>
            </div>
            <SelectField id="n-class" label="Asociar a una clase" optional value={form.sessionExternalId} onChange={(e) => setForm({ ...form, sessionExternalId: e.target.value })}>
              <option value="">Sin clase</option>
              {classes.map((c) => <option key={c.externalId} value={c.externalId}>{c.courseName} · {c.startTime}</option>)}
            </SelectField>
          </div>
          <Button type="submit" disabled={!canCreate} loading={busy} loadingText="Programando…" icon="alarm">Programar</Button>
        </form>
        {ok && <SuccessNotice>{ok}</SuccessNotice>}
      </FormSection>

      <section aria-labelledby="sched-title" className="space-y-2">
        <h2 id="sched-title" className="m-0 text-headline-md font-bold text-on-surface">Programadas</h2>
        {scheduled.length === 0 ? <p className={`${card} m-0 p-4 text-body-md text-on-surface-variant`}>No tienes notificaciones pendientes.</p> : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {scheduled.map((s) => (
              <li key={s.id} className={`${card} flex items-center gap-3 p-3`}>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-title-sm text-on-surface">{s.title}</p>
                  <p className="m-0 text-body-sm text-on-surface-variant">{new Date(s.fireAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })} · {s.message}</p>
                </div>
                <Button variant="danger" aria-label={`Cancelar ${s.title}`} onClick={async () => { try { await cancelScheduled(s.id); setScheduled(await listScheduled()); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cancelar'); } }}>Cancelar</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="hist-title" className="space-y-2">
        <h2 id="hist-title" className="m-0 text-headline-md font-bold text-on-surface">Recientes</h2>
        {history.length === 0 ? <p className={`${card} m-0 p-4 text-body-md text-on-surface-variant`}>Aún no tienes notificaciones.</p> : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {history.map((n) => (
              <li key={n.id} className={`${card} p-3`}>
                <p className="m-0 text-title-sm text-on-surface">{n.title}</p>
                <p className="m-0 text-body-sm text-on-surface-variant">{n.message}</p>
                <p className="m-0 mt-1 text-label-sm text-outline">{relativeTime(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
