export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
export const badRequest = (m = 'Solicitud inválida') => new AppError(400, 'BAD_REQUEST', m);
export const unauthorized = (m = 'No autenticado') => new AppError(401, 'UNAUTHORIZED', m);
export const forbidden = (m = 'Acceso denegado') => new AppError(403, 'FORBIDDEN', m);
export const notFound = (m = 'No encontrado') => new AppError(404, 'NOT_FOUND', m);
