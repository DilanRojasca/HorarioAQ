# features/admin — solo rol ADMIN

| Pantalla | Qué hace | Requisito |
|---|---|---|
| [`AdminPage.tsx`](AdminPage.tsx) | Sincronización manual, historial de corridas, **demo del patrón Observer** (envía una notificación de prueba a un estudiante) y panel de eventos | RF-ADM-03 |
| [`EventsPanel.tsx`](EventsPanel.tsx) | «Eventos recientes»: cada evento con la **entrega a cada observador** (OK/FALLIDO, intentos) | Observer visible |
| [`UsersPage.tsx`](UsersPage.tsx) | Asignar el rol de cada usuario (no el propio) | RF-AUTH-07 |
| [`CatalogPage.tsx`](CatalogPage.tsx) | Crear facultades y programas; reclasificar/eliminar programas | RF-ADM-01, RRF-03 |
| [`AuditPage.tsx`](AuditPage.tsx) | Log de auditoría con filtro por acción | RF-ADM-02 |
| `runs.ts` | Etiquetas/formatos (puro) | — |
