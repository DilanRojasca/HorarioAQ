# backend/src — mapa de la arquitectura

**Estilo:** monolito modular con arquitectura hexagonal (puertos y adaptadores). Documento completo: [docs/ARQUITECTURA.md](../../docs/ARQUITECTURA.md).

```
src/
├── main.ts          ← COMPOSITION ROOT: crea los adaptadores reales y los inyecta (Dependency Injection)
├── modules/         ← un módulo por capacidad del negocio (auth, schedule, gaps, notifications, realtime, catalog, audit)
│   └── <módulo>/
│       ├── domain/          capa de DOMINIO        reglas puras, sin I/O
│       ├── application/     capa de APLICACIÓN     casos de uso + PUERTOS (interfaces)
│       ├── infrastructure/  ADAPTADORES de salida  Prisma, argon2, JWT, Brevo, mock institucional…
│       └── http/            ADAPTADORES de entrada rutas Express + validación zod
├── shared/          ← núcleo transversal: contenedor DI, bus de eventos, errores, middlewares
└── jobs/            ← disparadores periódicos (cron) que llaman a casos de uso
```

## Cómo encontrar un patrón

La función, clase o interfaz que **implementa** un patrón lleva en su JSDoc la etiqueta `@pattern <Patrón> | <Rol> | <Por qué>`:

```ts
/**
 * ...
 * @pattern Observer | Subject (el bus) | Publica eventos sin conocer a quién los escucha.
 */
export class EventBus { ... }
```

```bash
grep -rn "@pattern Strategy" backend/src frontend/src     # todas las estrategias
cd backend && npm run patterns                             # regenera docs/INDICE_PATRONES.md (archivo:línea de cada marca)
```

## API v1 y Swagger

* Todas las rutas viven bajo `/api/v1` ([`shared/http/v1.ts`](shared/http/v1.ts)). Swagger UI: **`/api/v1/docs`**; contrato: `/api/v1/openapi.json`.
* La documentación se genera de los mismos esquemas zod que validan las peticiones (`modules/*/http/schemas.ts` → [`shared/openapi/paths.ts`](shared/openapi/paths.ts)); un test impide que diverja de las rutas reales.

## Regla de dependencia (la más importante)

```
http ──► application ──► domain          infrastructure ──implementa──► (puertos de application)
```

* `domain` **no importa nada** de Express, Prisma, `fetch` ni `process.env`.
* `application` solo conoce **puertos** (`ports.ts`); nunca una clase concreta de `infrastructure`.
* `http` e `infrastructure` no contienen reglas de negocio.
* Solo `shared/container.ts` y `main.ts` conocen todas las piezas: ahí se ensambla.

## Patrones por carpeta (resumen)

| Carpeta | Patrones | Lee su README |
|---|---|---|
| `modules/auth` | Repository, Adapter, Facade, Chain of Responsibility, Decorator, Command/Use Case | [auth](modules/auth/README.md) |
| `modules/schedule` | Repository, Adapter, Facade, Template Method, Strategy, Specification, Observer | [schedule](modules/schedule/README.md) |
| `modules/gaps` | Strategy, Facade, Repository | [gaps](modules/gaps/README.md) |
| `modules/notifications` | Observer, Strategy, Factory, Adapter, Idempotent Consumer | [notifications](modules/notifications/README.md) |
| `modules/realtime` | Observer (hacia el navegador) | [realtime](modules/realtime/README.md) |
| `modules/catalog` | Repository, Decorator (auditoría) | [catalog](modules/catalog/README.md) |
| `modules/audit` | Observer, Decorator, Repository | [audit](modules/audit/README.md) |
| `shared/events` | **Observer** (el bus) | [shared/events](shared/events/README.md) |
| `shared/http` | Chain of Responsibility | [shared/http](shared/http/README.md) |
| `shared` | Dependency Injection, Decorator, Singleton | [shared](shared/README.md) |
| `jobs` | Command (casos de uso invocados por tiempo) | [jobs](jobs/README.md) |
