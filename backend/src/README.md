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
