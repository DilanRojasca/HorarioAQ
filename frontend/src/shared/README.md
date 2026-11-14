# frontend/src/shared — transversal

| Archivo | Patrón | Qué hace |
|---|---|---|
| [`api.ts`](api.ts) | **Proxy / Interceptor** | Cliente HTTP único (`get/post/put/del/download`). Si una respuesta es 401 por token vencido, **rota el refresh token una sola vez** (*single-flight*: las peticiones concurrentes comparten el intento) y reintenta; si falla, emite `auth:expired` y la sesión se cierra (RNF-05). Las pantallas no saben que esto ocurre. |
| [`realtime.ts`](realtime.ts), [`RealtimeProvider.tsx`](RealtimeProvider.tsx) | **Observer** | `RealtimeClient` mantiene el flujo SSE (con `fetch` en streaming para mandar el token por cabecera) y reconecta con espera exponencial; `useRealtime('notification', fn)` suscribe un manejador. |
| [`ProtectedRoute.tsx`](ProtectedRoute.tsx) | **Guard** | Redirige a login o a la home del rol correcto antes de renderizar (RBAC en el cliente; el servidor vuelve a validar siempre). |
| [`Layout.tsx`](Layout.tsx) | — | Cabecera, barra de secciones por rol y enlace «Saltar al contenido» (accesibilidad). |
| [`forms.tsx`](forms.tsx) | DRY | `Field`, `AuthShell`, `ErrorNotice`, `SuccessNotice`, clases de botones: un solo estilo y un solo lugar para la accesibilidad (etiquetas, `aria-invalid`, `aria-describedby`). |
| [`ui.ts`](ui.ts), [`app.css`](app.css) | — | Tokens de diseño institucionales y clases compartidas. |
