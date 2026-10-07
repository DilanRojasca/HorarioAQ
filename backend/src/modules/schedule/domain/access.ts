import { forbidden } from '../../../shared/errors';
import { Role } from './types';

export function assertCanView(requester: { id: string; role: Role }, targetUserId: string): void {
  if (requester.id === targetUserId) return;
  if (requester.role === 'ADMIN') return;
  throw forbidden('Solo puedes consultar tu propio horario');
}
