# tests/ — pruebas del backend

`npm test` (Vitest + Supertest). Cobertura ≈ 99 % de líneas (umbral 70 %; se excluyen `main.ts`, `jobs/`, `Prisma*` y `Argon2Hasher`, que requieren infraestructura real).

| Carpeta | Qué prueba | Cómo |
|---|---|---|
| `auth/`, `gaps/`, `catalog/`, `schedule/`, `notifications/`, `realtime/` | Casos de uso y dominio de cada módulo | Contra **dobles en memoria** (`helpers/inMemory.ts`): posible porque el código depende de **puertos**, no de Prisma. |
| `http/` | Rutas completas con Supertest (`fullFlow.test.ts` recorre registro → OTP → sesión → huecos → programadas → admin) | Contenedor real + repositorios en memoria. |
| `shared/` | Bus de eventos, configuración, auditoría, ventana horaria | Unitarias. |

`helpers/inMemory.ts` es la prueba viva de la arquitectura hexagonal: cada `InMemory*` implementa el mismo puerto que su `Prisma*`.
