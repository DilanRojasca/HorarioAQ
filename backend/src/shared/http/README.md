# shared/http — adaptador de entrada y cadena de middlewares

> **Patrón:** Chain of Responsibility. Cada petición atraviesa una cadena de eslabones; cada uno la deja pasar, la rechaza o la transforma.

```
petición → helmet → cors → express.json → [ruta] authenticate → requireRole → zod (validación) → caso de uso → errorHandler
```

| Archivo | Eslabón |
|---|---|
| [`app.ts`](app.ts) | Arma la cadena y monta las rutas de cada módulo (`/api/auth`, `/api/schedule`, `/api/gaps`, `/api/catalog`, `/api/notifications`, `/api/events`, `/api/admin`). |
| [`auth.ts`](auth.ts) | `authenticate` (verifica JWT y que no esté revocado) → `requireRole('ADMIN')` (RBAC, RNF-06). Si el eslabón rechaza, los siguientes **no se ejecutan**. |
| [`asyncHandler.ts`](asyncHandler.ts) | Lleva los errores de funciones `async` a la cadena de errores. |
| [`errorHandler.ts`](errorHandler.ts) | Último eslabón: traduce `AppError`/`ZodError` a respuestas JSON coherentes. |

**Regla:** las rutas solo validan y delegan. Nunca contienen reglas de negocio: esas viven en `application/` y `domain/`.
