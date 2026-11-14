# frontend/src — SPA React organizada por *features*

React 18 + Vite + TypeScript + React Router + Tailwind. Arquitectura completa: [docs/ARQUITECTURA.md](../../docs/ARQUITECTURA.md).

```
src/
├── main.tsx / App.tsx   ← punto de entrada y tabla de rutas (con guardas por rol)
├── features/            ← UNA CARPETA POR FUNCIONALIDAD (pantallas + hooks + api de esa funcionalidad)
│   ├── auth/            registro, verificación OTP, recuperar contraseña, login, sesión
│   ├── schedule/        horario semanal, detalle, exportar, búsqueda y filtros
│   ├── gaps/            tiempos libres y sugerencias
│   ├── notifications/   campana, avisos emergentes, notificaciones programadas y preferencias
│   ├── profile/         perfil y foto
│   └── admin/           sincronización, eventos del Observer, usuarios/roles, catálogo, auditoría
└── shared/              ← lo transversal: cliente HTTP, tiempo real, layout, formularios, guardas
```

## Por qué «por feature» y no «por tipo»
Todo lo de una funcionalidad vive junta (pantalla, hook, llamadas a la API, pruebas). Para cambiar «Huecos» se toca **una** carpeta. Una feature no importa de otra
feature salvo por tipos/utilidades puntuales; lo común sube a `shared/`.

## Patrones del frontend
| Patrón | Dónde |
|---|---|
| **Provider / Context** (estado global sin prop-drilling) | `features/auth/AuthContext.tsx`, `features/notifications/ToastProvider.tsx`, `shared/RealtimeProvider.tsx` |
| **Custom Hooks** (separar datos de presentación) | `features/schedule/useSchedule.ts`, `features/notifications/useNotifications.ts` |
| **Observer** (eventos en vivo del servidor) | `shared/realtime.ts` → `useRealtime(tipo, manejador)` |
| **Proxy / Interceptor** (refresh token transparente) | `shared/api.ts` |
| **Guard** (rutas por rol) | `shared/ProtectedRoute.tsx` |
| **Chain of Responsibility** (validación) | `features/auth/registrationRules.ts` (réplica de la cadena del backend) |
| **Specification** (réplica cliente) | `features/schedule/filter.ts` |

Los README de cada carpeta detallan qué pantalla cumple qué requisito.
