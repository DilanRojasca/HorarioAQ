# features/profile

* [`ProfilePage.tsx`](ProfilePage.tsx) — RF-AUTH-06. Edita **nombre, foto y contraseña**; el correo institucional y el documento se muestran de solo lectura (y el servidor los rechaza igualmente por su esquema `.strict()`).
* [`avatar.ts`](avatar.ts) — `fileToAvatar`: valida tipo (PNG/JPG/WebP) y tamaño (≤ 5 MB), recorta al centro y reduce a 128×128 JPEG antes de enviar, para que la foto viaje como una data-URL pequeña.
