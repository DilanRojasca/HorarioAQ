# features/gaps

| Archivo | Qué hace |
|---|---|
| [`GapsPage.tsx`](GapsPage.tsx) | Lista los huecos agrupados por día (RF-HUE-01) con la **sugerencia que calcula el servidor** (RF-HUE-02, patrón Strategy en `backend/.../gaps/domain/suggestions.ts`); permite asignar una actividad propia (RF-HUE-03) y marcar el hueco ocupado/disponible (RF-HUE-04). |
| [`api.ts`](api.ts) | Llamadas tipadas a `/api/gaps`. |

El frontend **no calcula** huecos ni sugerencias: la regla vive en el dominio del backend (una sola fuente de verdad). La pantalla solo dibuja y envía acciones.
