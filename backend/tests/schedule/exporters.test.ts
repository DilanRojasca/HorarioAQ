import { describe, it, expect } from 'vitest';
import { IcsExporter } from '../../src/modules/schedule/infrastructure/exporters/IcsExporter';
import { PdfExporter } from '../../src/modules/schedule/infrastructure/exporters/PdfExporter';
import { session } from '../helpers/inMemory';

describe('IcsExporter', () => {
  const ex = new IcsExporter({ semesterStart: '2026-08-03', weeks: 16, now: () => new Date('2026-10-07T12:00:00Z') });

  it('genera un VEVENT semanal compatible con Google Calendar/Outlook', async () => {
    const r = await ex.export([session({ weekday: 3, startTime: '08:00', endTime: '10:00' })], 'Ana Pérez');
    const text = r.body.toString('utf8');
    expect(r.contentType).toBe('text/calendar; charset=utf-8');
    expect(r.filename).toBe('horario-ana-perez.ics');
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('DTSTART;TZID=America/Bogota:20260805T080000'); // miércoles de la 1.ª semana
    expect(text).toContain('DTEND;TZID=America/Bogota:20260805T100000');
    expect(text).toContain('RRULE:FREQ=WEEKLY;COUNT=16');
    expect(text).toContain('SUMMARY:Algoritmos');
    expect(text).toContain('LOCATION:Bloque A - Piso 2 - Aula 201');
    expect(text).toContain('UID:u1-ALG-1@horariouni');
    expect(text).toContain('\r\n');
    expect(text.trim().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('omite sesiones canceladas', async () => {
    const r = await ex.export([session({ status: 'CANCELLED' })], 'Ana');
    expect(r.body.toString()).not.toContain('BEGIN:VEVENT');
  });

  it('escapa comas y punto y coma en el texto', async () => {
    const r = await ex.export([session({ courseName: 'A, B; C' })], 'Ana');
    expect(r.body.toString()).toContain('SUMMARY:A\\, B\\; C');
  });
});

describe('PdfExporter', () => {
  it('genera un PDF válido', async () => {
    const r = new PdfExporter({ semester: '2026-2' }).export([session(), session({ externalId: 'x', weekday: 2 })], 'Ana Pérez');
    const result = await r;
    expect(result.contentType).toBe('application/pdf');
    expect(result.filename).toBe('horario-ana-perez.pdf');
    expect(result.body.subarray(0, 4).toString()).toBe('%PDF');
  });
});
