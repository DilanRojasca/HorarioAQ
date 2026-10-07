import { ClassSession } from '../../domain/types';
import { activeSessions, sortSessions } from '../../domain/sort';

export interface ExportResult { contentType: string; filename: string; body: Buffer }

export const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const DAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export abstract class BaseExporter {
  protected abstract readonly contentType: string;
  protected abstract readonly extension: string;
  protected abstract render(sessions: ClassSession[], ownerName: string): Promise<Buffer>;

  /** Plantilla: filtra y ordena, delega el render y arma el resultado. */
  async export(sessions: ClassSession[], ownerName: string): Promise<ExportResult> {
    const prepared = sortSessions(activeSessions(sessions));
    const body = await this.render(prepared, ownerName);
    return { contentType: this.contentType, filename: `horario-${slug(ownerName)}.${this.extension}`, body };
  }
}
