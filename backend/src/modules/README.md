# modules/ — un módulo por capacidad del negocio

Cada módulo es una **rebanada vertical** con las mismas cuatro carpetas (`domain`, `application`, `infrastructure`, `http`).
Esa uniformidad es intencional: quien entiende un módulo entiende todos.

| Módulo | Qué resuelve | Patrón estrella |
|---|---|---|
| [auth](auth/README.md) | Cuentas, OTP, sesión, perfil, roles | Chain of Responsibility · Adapter · Decorator |
| [schedule](schedule/README.md) | Horario, sincronización, exportación, búsqueda | Template Method · Specification · Facade |
| [gaps](gaps/README.md) | Huecos entre clases y sugerencias | **Strategy** |
| [notifications](notifications/README.md) | Avisos en la app, correo, recordatorios | **Observer** · Strategy |
| [realtime](realtime/README.md) | Empuje en vivo al navegador (SSE) | Observer |
| [catalog](catalog/README.md) | Facultades y programas | Repository |
| [audit](audit/README.md) | Registro y consulta de auditoría | Decorator · Observer |

**Los módulos no se importan entre sí en el dominio.** Cuando uno necesita algo de otro lo hace por un **puerto** (p. ej.
`auth` define `OtpMailer` y un adaptador lo conecta con el correo de `notifications`) o por **eventos** (`schedule` publica
`ScheduleChanged`; `notifications` y `audit` reaccionan sin que `schedule` los conozca).
