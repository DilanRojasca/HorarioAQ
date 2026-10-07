import { useState } from 'react';
import { api } from '../../shared/api';

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
    <div className="toolbar" role="group" aria-label="Exportar horario">
      <button className="btn secondary" disabled={busy} onClick={() => run('pdf')}>Exportar PDF</button>
      <button className="btn secondary" disabled={busy} onClick={() => run('ics')}>Exportar .ics (Google Calendar / Outlook)</button>
      {error && <span role="alert" className="error">{error}</span>}
    </div>
  );
}
