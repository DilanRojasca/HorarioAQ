import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

/**
 * Añade `.openapi({ example, description })` a zod. Se importa (por efecto) desde todo archivo
 * `schemas.ts` ANTES de definir esquemas, para que el mismo esquema que VALIDA la petición sea el que
 * DOCUMENTA el endpoint en Swagger (una sola fuente de verdad: la documentación no puede divergir).
 */
extendZodWithOpenApi(z);
export { z };
