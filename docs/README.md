# Documentación

| Documento | Para qué |
|---|---|
| [DOCUMENTO_ARQUITECTURA.md](DOCUMENTO_ARQUITECTURA.md) | **Documento principal de la entrega.** Alcance por módulo, justificación de Hexagonal frente a MVC, diagramas de puertos y adaptadores por módulo, estructura de carpetas, evidencia SOLID/DRY/KISS, patrones, requisitos no funcionales, seguridad, API con ejemplos, persistencia y pruebas. |
| [API_ENDPOINTS.md](API_ENDPOINTS.md) | Tabla de endpoints generada desde el contrato OpenAPI (`npm run docs:api` en `backend/`). |
| [GUIA_EJECUCION.md](GUIA_EJECUCION.md) | Cómo clonar, ejecutar backend y frontend, cargar datos de demostración, abrir Swagger y consultar la documentación. |
| [ARQUITECTURA.md](ARQUITECTURA.md) | **Empieza aquí.** Estilo arquitectónico, regla de dependencia, catálogo de patrones con enlaces al código, flujos, atributos de calidad y trazabilidad requisito → código → prueba. |
| [INDICE_PATRONES.md](INDICE_PATRONES.md) | **Generado automáticamente** desde las marcas `@pattern` del código: archivo y línea actuales de cada pieza que implementa un patrón. |
| [PATRONES.md](PATRONES.md) | Cada patrón con **archivo y línea** donde nace y donde se usa, por qué se usa ahí y cómo extenderlo. |
| [../README.md](../README.md) | Cómo ejecutar, variables de entorno, Docker, usuarios semilla, el patrón Observer en detalle. |
| [../backend/src/README.md](../backend/src/README.md) | Mapa del backend y regla de dependencia. |
| [../frontend/src/README.md](../frontend/src/README.md) | Mapa del frontend. |
| [superpowers/specs](superpowers/specs) | Diseños originales (horario académico, eventos/Observer). |
| [superpowers/plans](superpowers/plans) | Planes de implementación. |

Cada carpeta de `backend/src` y `frontend/src` tiene su propio `README.md` explicando qué patrón se usa en ella y por qué.
