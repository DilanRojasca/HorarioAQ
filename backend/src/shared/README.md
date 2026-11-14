# shared/ — núcleo transversal

Lo que no pertenece a un solo módulo. **Regla:** aquí no se importa un módulo concreto, excepto en `container.ts`, que es el único sitio de ensamblaje.

| Archivo | Patrón | Qué hace |
|---|---|---|
| [`container.ts`](container.ts) | **Dependency Injection** (composition root) + **Decorator** | `buildContainer(ports, config)` recibe los *puertos* ya construidos y devuelve los casos de uso listos. Aquí se envuelven con `withAudit`. Los tests le pasan dobles en memoria. |
| [`audit.ts`](audit.ts) | **Decorator** | `withAudit(audit, acción, casoDeUso, opts)` devuelve otro caso de uso que hace lo mismo y además registra quién/qué/cuándo. El caso de uso decorado ni sabe que lo auditan (RNF-14). |
| [`ports.ts`](ports.ts) | **Command / Use Case** | La interfaz `UseCase<I,O>` (`execute`) que implementan todos los casos de uso; puertos de auditoría (`AuditPort` para escribir, `AuditReader` para leer: Interface Segregation). |
| [`registerObservers.ts`](registerObservers.ts) | **Observer** | Único lugar donde se suscriben los observadores al bus. |
| [`prisma.ts`](prisma.ts) | **Singleton** | Un `PrismaClient` por proceso (un solo pool de conexiones). |
| [`config.ts`](config.ts), [`safeConfig.ts`](safeConfig.ts) | — | Lectura y validación de variables de entorno; falla al arrancar si algo es inseguro. |
| [`window.ts`](window.ts) | función pura | Ventana de envío 6:00–22:00 (RRF-05). |
| [`errors.ts`](errors.ts) | — | Errores de aplicación con código HTTP (`badRequest`, `conflict`, `notFound`…). |
| [`events/`](events/README.md) | Observer | El bus de eventos. |
| [`http/`](http/README.md) | Chain of Responsibility | Aplicación Express y middlewares. |
