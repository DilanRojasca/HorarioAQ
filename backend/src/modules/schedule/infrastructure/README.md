# schedule/infrastructure — adaptadores de salida

| Archivo | Implementa | Patrón |
|---|---|---|
| [`MockInstitutionalAdapter.ts`](MockInstitutionalAdapter.ts) | `InstitutionalPort` | **Adapter**. Simula el sistema de Admisiones/Registro. Para el real: otra clase que implemente el puerto y se cambia en `wire()`; casos de uso y rutas no cambian. |
| `PrismaScheduleRepository`, `PrismaEnrollmentRepository`, `PrismaSyncRunRepository` | los `*Repository` | **Repository** |
| [`exporters/BaseExporter.ts`](exporters/BaseExporter.ts) | clase abstracta | **Template Method**: `export()` (línea 17) define el esqueleto (filtrar activas y ordenar → `render()` → nombrar el archivo); las subclases solo implementan `render`. |
| [`exporters/PdfExporter.ts`](exporters/PdfExporter.ts), [`IcsExporter.ts`](exporters/IcsExporter.ts) | subclases | Template Method (PDF con pdfkit; `.ics` compatible con Google Calendar/Outlook) |
