import { useState } from 'react';
import { api } from '../../shared/api';

const btn =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] border border-outline-variant bg-surface-container-lowest px-3 text-label-md font-semibold text-on-surface hover:border-primary disabled:cursor-not-allowed disabled:opacity-60';

export default function ExportMenu() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(format: 'ics' | 'pdf') {
    setBusy(true); setError('');
    try { await api.download(`/schedule/me/export?format=${format}`, `horario.${format}`); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo exportar'); }
    finally { setBusy(false); }
  }
  return (
    <div role="group" aria-label="Exportar horario" className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" className={btn} disabled={busy} onClick={() => run('pdf')}>
          <span className="material-symbols-outlined text-[20px] text-secondary" aria-hidden="true">picture_as_pdf</span>
          Exportar PDF
        </button>
        <button type="button" className={btn} disabled={busy} onClick={() => run('ics')} title="Exportar .ics (Google Calendar / Outlook)">
          <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">event</span>
          Exportar .ics
        </button>
      </div>
      {error && <p role="alert" className="m-0 rounded-[10px] border border-error/30 bg-error-container/40 p-3 text-body-md font-medium text-error">{error}</p>}
    </div>
  );
}
