# features/auth

| Archivo | Qué hace | Patrón |
|---|---|---|
| [`AuthContext.tsx`](AuthContext.tsx) | Sesión (`user`, `login`, `logout`, `updateUser`); guarda token, refresh token y usuario en `sessionStorage` | **Provider / Context** |
| [`LoginPage.tsx`](LoginPage.tsx) | RF-AUTH-02 | — |
| [`RegisterPage.tsx`](RegisterPage.tsx) | RF-AUTH-01: validación en tiempo real, botón deshabilitado hasta que todo sea válido | usa la cadena de `registrationRules.ts` |
| [`registrationRules.ts`](registrationRules.ts) | Réplica del backend (`auth/domain/registrationRules.ts`): correo `@amigo.edu.co`, contraseña fuerte, nombre completo, documento | **Chain of Responsibility** (cliente) |
| [`VerifyPage.tsx`](VerifyPage.tsx) | RF-AUTH-05: OTP de 6 dígitos + reenviar código | — |
| [`ForgotPasswordPage.tsx`](ForgotPasswordPage.tsx) | RF-AUTH-04: pedir código → restablecer (dos pasos) | — |

El cliente valida solo por comodidad; **el servidor valida siempre** (la validación del cliente nunca es seguridad).
