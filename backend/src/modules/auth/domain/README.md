# auth/domain — reglas puras

**Sin I/O.** Se prueba sin base de datos ni servidor.

* [`registrationRules.ts`](registrationRules.ts) — **Chain of Responsibility**. Cada `RegistrationRule` es un eslabón con una sola responsabilidad (`institutionalEmailRule`, `fullNameRule`, `documentRule`, `passwordStrengthRule`). `runRegistrationChain` los recorre y junta **todos** los mensajes (mejor UX que parar en el primer error). Para añadir una validación se agrega un eslabón a `DEFAULT_REGISTRATION_CHAIN`; ninguno existente cambia (Open/Closed).
  También expone `passwordProblem`, la política de contraseña que reutilizan recuperación y cambio de contraseña (DRY).
  El frontend tiene una réplica en `frontend/src/features/auth/registrationRules.ts` para validar en tiempo real.
