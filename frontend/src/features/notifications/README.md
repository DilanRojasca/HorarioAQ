# features/notifications

| Archivo | Qué hace | Patrón |
|---|---|---|
| [`NotificationBell.tsx`](NotificationBell.tsx) + [`useNotifications.ts`](useNotifications.ts) | Campana con contador y lista; se actualiza con el evento `notification` | **Custom Hook** + **Observer** (`useRealtime`) |
| [`ToastProvider.tsx`](ToastProvider.tsx) | Avisos emergentes accesibles (`aria-live`) | **Provider / Context** |
| [`NotificationsPage.tsx`](NotificationsPage.tsx) | RF-NOT-01 programar notificaciones propias (con clase opcional), RF-NOT-02 antelación del recordatorio, RF-NOT-04 canal preferido; lista programadas e historial | — |
| [`api.ts`](api.ts) | Llamadas tipadas | — |
| `relativeTime.ts` | «hace 5 min» (puro) | — |
