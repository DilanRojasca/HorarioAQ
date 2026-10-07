import PDFDocument from 'pdfkit';
import { ClassSession } from '../../domain/types';
import { BaseExporter, DAY_NAMES } from './BaseExporter';

export class PdfExporter extends BaseExporter {
  protected readonly contentType = 'application/pdf';
  protected readonly extension = 'pdf';
  constructor(private opts: { semester: string }) { super(); }

  protected render(sessions: ClassSession[], ownerName: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('Horario UNI', { align: 'left' });
      doc.fontSize(11).fillColor('#444').text(`${ownerName} — Semestre ${this.opts.semester}`).moveDown();
      doc.fillColor('#000');

      let currentDay = 0;
      for (const s of sessions) {
        if (s.weekday !== currentDay) {
          currentDay = s.weekday;
          doc.moveDown(0.5).fontSize(13).fillColor('#1F6F8B').text(DAY_NAMES[currentDay]).fillColor('#000');
        }
        doc.fontSize(11).text(`${s.startTime}–${s.endTime}  ${s.courseName} (${s.courseCode})`);
        doc.fontSize(9).fillColor('#555')
          .text(`Docente: ${s.teacher} · Bloque ${s.block}, piso ${s.floor}, aula ${s.room}`, { indent: 12 })
          .fillColor('#000');
      }
      if (sessions.length === 0) doc.fontSize(11).text('Sin clases registradas.');
      doc.end();
    });
  }
}
