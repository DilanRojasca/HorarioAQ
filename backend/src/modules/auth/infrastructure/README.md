# auth/infrastructure — adaptadores de salida

Implementan los puertos de `application/ports.ts`. Es lo único que se reemplaza si cambia la tecnología.

| Archivo | Implementa | Patrón |
|---|---|---|
| `PrismaUserRepository`, `PrismaOtpRepository`, `PrismaRefreshTokenRepository`, `PrismaRevokedTokenRepository` | `*Repository` | **Repository** (PostgreSQL). Los reclamos atómicos (`markUsed`, `consume`) son `UPDATE … WHERE … IS NULL`: solo gana quien lo ejecuta primero. |
| [`Argon2Hasher`](Argon2Hasher.ts) | `PasswordHasher` | **Adapter** sobre la librería `argon2` (RNF-04). |
| [`JwtTokenService`](JwtTokenService.ts) | `TokenService` | **Adapter** sobre `jsonwebtoken` (HS256, 60 min). |
| [`CryptoOtpCodec`](CryptoOtpCodec.ts) | `OtpCodec` | Genera códigos con `crypto.randomInt` y guarda solo su HMAC. |
| [`EmailOtpMailer`](EmailOtpMailer.ts) | `OtpMailer` | **Adapter**: adapta el `EmailPort` de `notifications` (consola/Brevo) al puerto de auth. |
| [`DevLoggingOtpMailer`](DevLoggingOtpMailer.ts) | `OtpMailer` | **Decorator**: envuelve a otro mailer y además imprime el código. **Solo en desarrollo** con `EMAIL_MODE=console` (ver `main.ts`); nunca en producción. |
