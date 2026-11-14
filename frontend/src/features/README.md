# features/ — una carpeta por funcionalidad

Convención dentro de cada feature: `*Page.tsx` (pantalla), `use*.ts` (hook de datos), `api.ts` (llamadas HTTP tipadas), componentes pequeños y sus `*.test.tsx`.
La pantalla **dibuja**; el hook/`api.ts` **obtiene y envía datos**; las reglas puras van en archivos `.ts` sin React (`filter.ts`, `registrationRules.ts`, `time.ts`, `grid.ts`) para probarlas sin renderizar.

| Feature | Requisitos |
|---|---|
| [auth](auth/README.md) | RF-AUTH-01..05, RRF-06 |
| [schedule](schedule/README.md) | RF-HOR-01..04, RF-BUS-01/02 |
| [gaps](gaps/README.md) | RF-HUE-01..04 |
| [notifications](notifications/README.md) | RF-NOT-01..04 |
| [profile](profile/README.md) | RF-AUTH-06 |
| [admin](admin/README.md) | RF-ADM-01..03, RF-AUTH-07 |
