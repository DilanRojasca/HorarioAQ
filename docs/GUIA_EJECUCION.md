# Guía de ejecución y consulta de la documentación

**Repositorio:** https://github.com/DilanRojasca/HorarioAQ

Esta guía describe cómo obtener el proyecto, ejecutarlo en un entorno local y consultar la documentación técnica y de la API.

## 1. Requisitos previos

| Componente | Versión |
|---|---|
| Node.js | 20 o superior |
| PostgreSQL | 14 o superior (alternativa: Docker con Compose v2) |
| Git | cualquier versión reciente |

## 2. Obtener el código

```bash
git clone https://github.com/DilanRojasca/HorarioAQ.git
cd HorarioAQ
```

## 3. Base de datos

Crear el rol y la base de datos (credenciales exclusivas de desarrollo):

```sql
CREATE ROLE horario LOGIN PASSWORD 'horario' CREATEDB;
CREATE DATABASE horario OWNER horario;
```

## 4. Backend (puerto 4000)

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run seed
npm run dev
```

El servidor queda disponible en `http://localhost:4000/api/v1`. Para verificar su estado: `GET http://localhost:4000/api/v1/health`, que responde `{"ok":true,"version":"v1"}`.

Las variables de entorno (conexión a la base de datos, secreto JWT, semestre activo, correo, etc.) se describen en el README del proyecto, sección «Variables de entorno».

## 5. Frontend (puerto 5173)

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

La aplicación se abre en `http://localhost:5173`. Si el puerto está ocupado, Vite asigna el siguiente disponible y lo indica en la consola; el frontend reenvía las peticiones `/api` al backend en el puerto 4000.

## 6. Datos de demostración

El comando `npm run seed` carga un conjunto mínimo de usuarios. Para un conjunto completo de demostración (varios estudiantes de distintas carreras, horarios con huecos de diferente duración, dos administradores, notificaciones y rastro de auditoría):

```bash
cd backend
npm run seed:demo
```

Este comando es re-ejecutable: reemplaza horarios, notificaciones, huecos, eventos y corridas de sincronización, y conserva los usuarios y el catálogo. No se ejecuta en producción.

La contraseña de los usuarios de demostración es el valor de `SEED_PASSWORD` definido en `backend/.env` (por defecto, el indicado en `backend/.env.example`).

| Rol | Correo | Descripción |
|---|---|---|
| Administrador | `admin@horariouni.test` | Sincronización, usuarios y roles, catálogo, auditoría, eventos |
| Administrador | `coordinacion@amigo.edu.co` | Segundo administrador |
| Estudiante | `dilan@horariouni.test` | Ingeniería de Sistemas, con notificaciones |
| Estudiante | `laura.gomez@amigo.edu.co` | Psicología, con actividad en un hueco |
| Estudiante | `camila.torres@amigo.edu.co` | Administración de Empresas |
| Estudiante | `juan.herrera@amigo.edu.co` | Ingeniería Industrial |
| Estudiante | `valentina.rios@amigo.edu.co` | Ingeniería de Sistemas (jornada mixta) |
| Estudiante | `sinmatricula@horariouni.test` | Sin matrícula vigente (RRF-01) |
| Estudiante | `pendiente.verificar@amigo.edu.co` | Cuenta sin verificar (el inicio de sesión responde 403) |

**Flujo de demostración sugerido:** iniciar sesión como administrador → «Sincronización» → «Sincronizar ahora» (genera cambios de aula, cancelaciones y clases nuevas, y notificaciones reales) → revisar «Eventos recientes» → iniciar sesión como estudiante para ver la campana de notificaciones, los huecos y el calendario.

En desarrollo (`EMAIL_MODE=console`), los códigos OTP de registro y recuperación de contraseña se imprimen en la consola del backend con el prefijo `[otp:dev]`.

## 7. Documentación de la API (Swagger / OpenAPI)

Con el backend en ejecución:

| Recurso | URL |
|---|---|
| Interfaz interactiva (Swagger UI) | `http://localhost:4000/api/v1/docs` |
| Contrato OpenAPI 3.0 (JSON) | `http://localhost:4000/api/v1/openapi.json` |

Para probar endpoints protegidos: ejecutar `POST /auth/login`, pulsar **Authorize** y pegar el valor `token` de la respuesta (sin el prefijo `Bearer`).

## 8. Documentación técnica del proyecto

| Documento | Ubicación | Contenido |
|---|---|---|
| Documento de arquitectura (principal) | `docs/DOCUMENTO_ARQUITECTURA.md` | Alcance, justificación del patrón, diagramas por módulo, SOLID/DRY/KISS, patrones, RNF, API, persistencia |
| Visión general (anexo) | `docs/ARQUITECTURA.md` | Estilo arquitectónico, capas, módulos, flujos, atributos de calidad, trazabilidad de requisitos |
| Patrones de diseño | `docs/PATRONES.md` | Cada patrón: ubicación, justificación y forma de extenderlo |
| Índice de patrones | `docs/INDICE_PATRONES.md` | Archivo y línea de cada marca `@pattern` (generado) |
| Documento PDF | `docs/Horario_UNI_Arquitectura_y_Patrones.pdf` | Versión consolidada para lectura e impresión |
| README del proyecto | `README.md` | Instalación, variables de entorno, Docker, patrón Observer |
| README por carpeta | `backend/src/**/README.md`, `frontend/src/**/README.md` | Patrones aplicados en cada carpeta |

Los patrones también pueden localizarse directamente en el código mediante la etiqueta `@pattern`:

```bash
grep -rn "@pattern Observer" backend/src frontend/src
```

La tabla de endpoints puede regenerarse con `npm run docs:api` y el índice de patrones con `npm run patterns` (ambos desde `backend/`) y el PDF con `docs/pdf/build.sh` (requiere `pandoc` y un navegador basado en Chromium).

## 9. Pruebas

```bash
cd backend && npm test          # pruebas del backend (cobertura: npm run test:cov)
cd frontend && npx vitest run   # pruebas del frontend
```

## 10. Ejecución con Docker (alternativa)

```bash
export JWT_SECRET=$(openssl rand -hex 32)
docker compose up --build
```

La aplicación queda disponible en `http://localhost:8080` (nginx sirve el frontend y reenvía `/api/` al backend). La documentación Swagger queda en `http://localhost:8080/api/v1/docs`.
