# auth/application — casos de uso y puertos

| Archivo | Qué es | Patrón |
|---|---|---|
| [`ports.ts`](ports.ts) | Interfaces que el módulo necesita: `UserRepository`, `OtpRepository`, `OtpCodec`, `OtpMailer`, `RefreshTokenRepository`, `PasswordHasher`, `TokenService`, `RevokedTokenRepository` | **Ports** (hexagonal) + **Repository** |
| [`Register.ts`](Register.ts) | RF-AUTH-01: cadena de validación → unicidad → hash → cuenta inactiva → OTP | **Facade** |
| [`VerifyAccount.ts`](VerifyAccount.ts) | RF-AUTH-05 (y reenvío del código) | Use Case |
| [`PasswordReset.ts`](PasswordReset.ts) | RF-AUTH-04: pedir código / restablecer (revoca sesiones) | Use Case |
| [`UpdateProfile.ts`](UpdateProfile.ts) | RF-AUTH-06 perfil + RF-NOT-02/04 preferencias | Use Case |
| [`ManageUsers.ts`](ManageUsers.ts) | RF-AUTH-07: listar y cambiar rol | Use Case |
| [`Login.ts`](Login.ts), [`Logout.ts`](Logout.ts) | RF-AUTH-02/03 | Use Case |
| [`OtpService.ts`](OtpService.ts) | Política única del OTP (vigencia, intentos, un solo uso) usada por registro y recuperación | Servicio de aplicación (DRY) |
| [`RefreshTokenService.ts`](RefreshTokenService.ts) | Emitir y rotar refresh tokens | Servicio de aplicación |

Estas clases **solo conocen puertos**: ninguna importa Prisma, Express ni librerías de correo.
