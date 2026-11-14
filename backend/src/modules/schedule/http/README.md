# schedule/http — adaptadores de entrada

* [`scheduleRoutes.ts`](scheduleRoutes.ts): `GET /me` (con filtros `q`, `weekday`, `block`, `teacher` validados con zod), `GET /me/export?format=ics|pdf`, `GET /users/:id` (solo ADMIN, auditado), `GET /sessions/:externalId`.
* [`adminRoutes.ts`](adminRoutes.ts) (todo bajo `authenticate → requireRole('ADMIN')`): `POST /sync`, `GET /sync/runs`, `GET /events`, `POST /events/test` (demo del Observer), `GET /students`, `GET/PUT /users…` (roles), `GET /audit`.

No hay rutas para crear/editar/borrar clases: el horario solo cambia por sincronización (RRF-02/07).
