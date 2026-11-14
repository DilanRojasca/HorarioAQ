# auth/http — adaptador de entrada

[`authRoutes.ts`](authRoutes.ts): valida con **zod**, aplica *rate-limit* a login/OTP, delega en el caso de uso y devuelve JSON. No contiene reglas de negocio.

| Ruta | Caso de uso | Requisito |
|---|---|---|
| `POST /register` | `RegisterUseCase` | RF-AUTH-01 |
| `POST /verify`, `/verify/resend` | `VerifyAccountUseCase` | RF-AUTH-05 |
| `POST /login`, `/refresh`, `/logout` | `LoginUseCase`, `RefreshTokenService`, `LogoutUseCase` | RF-AUTH-02/03, RNF-05 |
| `POST /password/forgot`, `/password/reset` | `PasswordReset` | RF-AUTH-04 |
| `GET/PUT /me` | `GetProfile`, `UpdateProfile` | RF-AUTH-06 |

`PUT /me` admite un cuerpo de hasta 256 kb (la foto viaja como data-URL pequeña); el resto de la API, 100 kb.
