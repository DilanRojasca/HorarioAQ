# módulo auth — cuentas, sesión y roles

Requisitos: RF-AUTH-01..07 · RNF-04/05/06/07 · RRF-06. Prefijo HTTP: `/api/auth` (+ `/api/admin/users` para roles).

## Capas y patrones
| Capa | Archivos clave | Patrón y por qué |
|---|---|---|
| [`domain/`](domain/README.md) | `registrationRules.ts` | **Chain of Responsibility**: la validación del registro es una cadena de eslabones independientes (nombre, documento, correo institucional, contraseña). |
| [`application/`](application/README.md) | `Register`, `VerifyAccount`, `PasswordReset`, `UpdateProfile`, `ManageUsers`, `Login`, `Logout`, `OtpService`, `RefreshTokenService`, `ports.ts` | **Command/Use Case** (cada acción = una clase con `execute`), **Facade** (`RegisterUseCase` orquesta validar → guardar → OTP) y **puertos** (`UserRepository`, `OtpRepository`, `OtpMailer`, `TokenService`…). |
| [`infrastructure/`](infrastructure/README.md) | `Prisma*Repository`, `Argon2Hasher`, `JwtTokenService`, `CryptoOtpCodec`, `EmailOtpMailer`, `DevLoggingOtpMailer` | **Repository**, **Adapter** y **Decorator**. |
| [`http/`](http/README.md) | `authRoutes.ts` | Adaptador de entrada: zod `.strict()` + rate-limit. |

## Decisiones que conviene saber
* **La cuenta nace inactiva** y se activa al confirmar el OTP (RF-AUTH-05). El login distingue «contraseña mala» (401) de «cuenta sin verificar» (403) **solo después** de comprobar la contraseña, para no revelar qué correos existen.
* **El OTP no pasa por el bus de eventos** (el bus guarda los payloads en BD); se entrega por el puerto `OtpMailer`.
* **OTP:** 6 dígitos con CSPRNG, se guarda su HMAC-SHA256, vigencia 10 min, un solo uso, 5 intentos.
* **Refresh token opaco y rotativo** (7 días; se guarda su sha256); reutilizar uno ya consumido falla (RNF-05).
* **Perfil:** el esquema `zod .strict()` rechaza cualquier campo que no sea nombre/foto/contraseña, así el correo y el documento no se pueden cambiar (RF-AUTH-06).
* **Roles:** un administrador no puede cambiar su propio rol; cada cambio se audita con su ID (no repudio).
