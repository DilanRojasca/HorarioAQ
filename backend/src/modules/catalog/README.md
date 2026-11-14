# módulo catalog — facultades y programas

Requisitos: RF-ADM-01 · RRF-03. Prefijo: `/api/catalog` (lectura: cualquier sesión; escritura: solo ADMIN).

| Archivo | Patrón |
|---|---|
| [`application/CatalogUseCases.ts`](application/CatalogUseCases.ts) | Use Cases + puerto **Repository** (`CatalogRepository`). **RRF-03:** `CreateProgramUseCase` rechaza un programa sin una facultad existente; el código de programa es único. |
| [`infrastructure/PrismaCatalogRepository.ts`](infrastructure/PrismaCatalogRepository.ts) | Repository (tablas `Faculty` y `Program`, con clave foránea obligatoria). |
| [`http/catalogRoutes.ts`](http/catalogRoutes.ts) | Adaptador de entrada. |

Cada alta/cambio/baja queda en el log con el ID del administrador: en `shared/container.ts` los casos de uso se envuelven con el **Decorator** `withAudit` (`CATALOG_CREATE_FACULTY`, `CATALOG_CREATE_PROGRAM`, `CATALOG_UPDATE_PROGRAM`, `CATALOG_DELETE_PROGRAM`).
