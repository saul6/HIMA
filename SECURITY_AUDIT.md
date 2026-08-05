# Auditoría de Seguridad — M.A.D.Y

**Fecha:** 2026-08-04
**Alcance:** Frontend React+TS+Vite (`src/`) + integración Supabase + configuración de despliegue
**Revisor:** análisis estático + `pnpm audit --prod` + inspección de git history
**Estado:** Solo reporte — sin cambios de código aplicados

---

## Resumen ejecutivo

| Severidad   | Cantidad |
|-------------|----------|
| Crítico     | 0        |
| Alto        | 3        |
| Medio       | 4        |
| Bajo        | 3        |
| Informativo | 5        |

El aislamiento multi-tenant está correctamente delegado a RLS en Supabase — no se encontró ningún bypass de autorización explotable desde el frontend. Los hallazgos de mayor impacto son: dependencias con CVEs acumulados en `react-router`, una ruta de diagnóstico sin guard de autenticación accesible en producción, y logs de perfil completo impresos en consola del navegador.

---

## Tabla de hallazgos

### Alto

| # | Categoría | Archivo:línea | Descripción del riesgo | Corrección propuesta | Esfuerzo |
|---|-----------|--------------|------------------------|----------------------|----------|
| A1 | Dependencias CVE | `package.json` — `react-router 7.13.0` | `pnpm audit --prod` reporta **12 HIGH + 6 moderate** en `react-router`. Incluye: XSS en RSC (GHSA-2j2x-hqr9-3h42), DoS vía path no acotado, DoS vía turbo-stream, open redirect vía backslash en `<Link>`, stored XSS vía Location header, CSRF bypass en RSC Mode, inyección de constructor arbitrario, open redirect via `//`. La versión instalada (7.13.0) está por debajo de todos los parches disponibles. Los CVEs RSC (XSS, CSRF) son irrelevantes porque esta app usa CSR sin React Server Components, pero los DoS y open redirect sí aplican. | Actualizar a `react-router ≥ 7.18.0` (cubre todos los CVEs aplicables). El CVE de RSC CSRF requiere ≥ 8.3.0 pero no aplica (sin RSC). Comando: `pnpm update react-router`. Verificar que los imports siguen siendo de `'react-router'` (sin `-dom`). | Bajo — bump de versión, sin cambio de API |
| A2 | Ruta de debug sin autenticación | `src/app/routes.tsx:63` + `src/app/screens/TestSupabase.tsx:1-27` | La ruta `/test` renderiza `TestSupabase` **fuera de cualquier wrapper de auth** (`RequireAuth`, `RequireOrg`). Cualquier visitante no autenticado puede abrirla. El componente: (1) hace un `fetch` directo a la REST API de Supabase con la anon key visible en el header `Authorization` (inspeccionable en DevTools → Network), (2) imprime la respuesta JSON cruda de `profiles` en el DOM, (3) expone el Project ID completo en la URL del fetch. RLS limita los datos devueltos, pero la ruta es superficie de reconocimiento innecesaria en producción. | Eliminar `TestSupabase.tsx` y su entrada en `routes.tsx:58-64`. Si se necesita para QA puntual, protegerla al menos con `RequireAuth` + guard `rol === 'super_admin'`. | Muy bajo — eliminar dos archivos y 4 líneas de routes |
| A3 | PII de perfil en `console.log` de producción | `src/hooks/useAuth.ts:35,42,55,59,66,77,86,96,102,108,126,133,140,142,149,167,179,210` | 17 llamadas a `console.log/warn/error` imprimen en la consola del navegador los objetos de perfil completos: `profile` (contiene `org_id`, `rol`, `nombre_completo`, `activo`), `productor`, `asesorProfile`, `responsableProfile`. Esto es PII y metadata de tenant visible para: (1) cualquier persona con acceso físico al dispositivo, (2) extensiones de browser con acceso a la consola, (3) sistemas de error-reporting configurados para capturar logs (Sentry, LogRocket, etc.). No se imprime el JWT raw, pero sí datos suficientes para reconocimiento de estructura de tenant. | Envolver todos los `console.*` en `if (import.meta.env.DEV) { ... }`. Alternativamente, crear un helper `devLog(...args)` que aplique el guard. Los `console.error` de bloque `catch` pueden mantenerse pero sin imprimir el objeto `profile` completo. | Bajo — edición en un solo archivo |

---

### Medio

| # | Categoría | Archivo:línea | Descripción del riesgo | Corrección propuesta | Esfuerzo |
|---|-----------|--------------|------------------------|----------------------|----------|
| M1 | Headers HTTP de seguridad ausentes | `vercel.json:1-3` | El archivo solo contiene la rewrite SPA. No hay ningún header de seguridad. Superficie de riesgo: **clickjacking** (sin `X-Frame-Options` o CSP `frame-ancestors none`), **MIME sniffing** (sin `X-Content-Type-Options: nosniff`), **downgrade HTTP** (sin `Strict-Transport-Security`), **referrer leak** a dominios externos (sin `Referrer-Policy`). Vercel no añade estos headers por defecto en proyectos sin framework. | Añadir bloque `"headers"` en `vercel.json` con: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000; includeSubDomains`. CSP completo requiere más trabajo (nonces con Vite), puede añadirse en iteración posterior partiendo de `Content-Security-Policy: default-src 'self'` con excepciones para Supabase y Turnstile. | Bajo — editar un JSON de config |
| M2 | Sourcemaps de producción publicados | `vite.config.ts:6-29` | Vite incluye sourcemaps en el bundle de producción por defecto. Los archivos `.js.map` desplegados en Vercel exponen el código TypeScript fuente completo: lógica de negocio, nombres exactos de tablas y columnas Supabase, queries RPC, estructuras internas. Cualquiera puede acceder vía DevTools → Sources o descargando los `.map` directamente. | Añadir `build: { sourcemap: false }` en `vite.config.ts`. Si se necesitan sourcemaps para debugging de errores en producción, usar `sourcemap: 'hidden'` + subirlos a Sentry/Datadog sin servirlos públicamente. | Muy bajo — una línea de config |
| M3 | Sin validación client-side de tipo/tamaño en uploads | `src/lib/storage/incidenciasStorage.ts:5-9`, `src/lib/storage/accionesCorrectivasStorage.ts:5-9` | Las funciones `subirFoto(path, file)` y `subirFotoAccion(path, file)` hardcodean `contentType: 'image/jpeg'` pero no validan `file.type` ni `file.size` antes de subir. Un usuario autenticado podría subir archivos de cualquier tipo (PDF, SVG con scripts, ejecutables) con tamaño hasta el límite del bucket (50 MB por defecto en Supabase). La política RLS de Storage controla *quién* puede escribir pero no *qué* se escribe. | En los callers (pantallas M13, M20, M21, M26) validar antes del upload: tipo MIME contra lista blanca `['image/jpeg','image/png','image/webp']` y tamaño máximo (ej. 10 MB). Los mensajes de error deben mostrarse con `toast.error(...)`. Opcionalmente, también aplicar la restricción en la Storage Policy de Supabase (fuera de alcance de esta auditoría). | Bajo — validación en ~4 pantallas |
| M4 | URL real del proyecto en `.env.example` commiteado | `.env.example` (root, en git) | `.env.example` contiene `VITE_SUPABASE_URL=https://glrjesvtsspilkacooln.supabase.co` — la URL real con el Project ID visible en el historial permanente de git. No expone la anon key ni la service key (ambas están vacías), pero el Project ID facilita el reconocimiento (necesario para llamadas directas a la REST/RPC API). | Reemplazar por placeholder: `VITE_SUPABASE_URL=https://<project-id>.supabase.co`. Si se desea purgar del historial, usar `git filter-repo --path .env.example --invert-paths` + force push. El `.env` real está correctamente ignorado por `.gitignore`. | Muy bajo — editar una línea |

---

### Bajo

| # | Categoría | Archivo:línea | Descripción del riesgo | Corrección propuesta | Esfuerzo |
|---|-----------|--------------|------------------------|----------------------|----------|
| B1 | CVE moderate en `uuid` (transitivo) | `package.json` | `uuid < 11.1.1` tiene buffer bounds check ausente en funciones v3/v5/v6 al recibir un buffer externo. Impacto bajo en este contexto: `uuid` se usa solo para generar IDs aleatorios, no para parsear UUIDs de entrada no confiable. | `pnpm update` para actualizar la dependencia que lo arrastra (probablemente `exceljs`). | Muy bajo |
| B2 | CVEs HIGH en `brace-expansion` (devDependency) | `package.json` | `brace-expansion < 2.1.4` tiene DoS vía expansión exponencial de patrones glob. Está solo en devDependencies (herramientas de build: vite, typescript). **No forma parte del bundle de producción.** Riesgo real: nulo en producción; teórico en pipelines CI con inputs no confiables. | `pnpm update` para actualizar las devDeps que lo arrastran. | Muy bajo |
| B3 | TTL de signed URLs sin invalidación activa | `src/lib/storage/incidenciasStorage.ts:12-17`, `src/lib/storage/accionesCorrectivasStorage.ts:12-16` | TTLs de 60 s (incidencias) y 120 s (acciones correctivas) son adecuados. No existe mecanismo programático para invalidar URLs ya emitidas si se revoca acceso a un registro. En el modelo actual esto es aceptable. | Documentar el comportamiento. Si en el futuro se implementa revocación de acceso por registro, reducir TTL a ≤ 30 s o implementar invalidación via rotación de policy en Supabase Storage. | Informativo por ahora |

---

### Informativo

| # | Observación | Veredicto |
|---|-------------|-----------|
| I1 | `VITE_SUPABASE_ANON_KEY` y `VITE_SUPABASE_URL` en el bundle de producción | **Por diseño, correcto.** Supabase requiere la anon key en el cliente. La seguridad real es RLS en BD. La anon key sin RLS no otorga acceso a datos de otras organizaciones. |
| I2 | Guards de ruta (`RequireAuth`, `RequireModulo`, `RequireOrg`) son UX, no seguridad | **Por diseño, correcto.** La frontera real de autorización es `get_my_org_id()` en RLS + políticas de tabla. Una petición directa a Supabase sin pasar por los guards fallaría igual por RLS. Documentado en CLAUDE.md. |
| I3 | Turnstile CAPTCHA: el front pasa el token a `supabase.auth.signInWithPassword` sin validarlo | **Correcto.** Supabase Auth valida el token Cloudflare server-side. El front no necesita (ni debe) validarlo; solo lo reenvía. |
| I4 | Paths de Storage construidos con `profile.org_id` del auth context en los callers | **Correcto en todos los callers revisados.** M13, M20, M21 y M26 construyen el path usando `profile.org_id` de `useAuthContext()`, nunca de input del usuario. La función de librería `subirFoto(path, file)` no valida el prefijo por sí misma — la defensa final recae en las Storage Policies RLS del bucket (verificar en Supabase Dashboard que las policies usan `auth.uid()` o `get_my_org_id()`). |
| I5 | No se encontró `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, ni `target="_blank"` sin `rel="noopener noreferrer"` | **XSS por inyección de HTML descartado** en todo el árbol `src/`. |

---

## Falsos positivos / aceptados por diseño

- **`SECURITY DEFINER` en funciones Postgres** — intencional en `get_my_org_id()`, `get_mis_modulos()`, `completar_registro_organizacion()` y otras RPCs multi-tenant. Es el mecanismo correcto para acceso cross-user controlado.
- **`(supabase as any).from('tabla')`** — cast necesario para tablas no tipadas aún. No es inyección; el cliente Supabase JS parametriza las queries internamente.
- **`SUPABASE_SERVICE_ROLE_KEY=` en `.env.example`** — el nombre de variable está (correcto para documentar), el valor está vacío. Solo los scripts `seed:*` la leen via `process.env` en Node.js local; nunca llega al bundle de Vite.
- **Anon key visible en headers de `TestSupabase.tsx`** — la anon key es pública por diseño. El hallazgo A2 es por la ausencia de auth guard, no por la clave en sí.
- **Console logs del prefijo `[auth]` que no imprimen objetos de perfil** (líneas 126, 133, 140, 142, 167, 210) — solo imprimen strings literales o booleanos simples; bajo riesgo. El hallazgo A3 se enfoca en las líneas que imprimen objetos completos.

---

## Prioridad de remediación sugerida

| Orden | Hallazgo | Tiempo estimado | Motivo |
|-------|----------|-----------------|--------|
| 1 | A2 — Eliminar ruta `/test` | 10 min | Máximo impacto, mínimo esfuerzo |
| 2 | M2 — `sourcemap: false` en vite.config | 2 min | Una línea, efecto inmediato |
| 3 | A1 — Actualizar react-router ≥ 7.18.0 | 30 min | Cubre 12 CVEs de una vez |
| 4 | A3 — Guard `if (import.meta.env.DEV)` en useAuth.ts | 20 min | Elimina PII de consola en producción |
| 5 | M1 — Headers de seguridad en vercel.json | 15 min | Mitigación de clickjacking/sniffing |
| 6 | M4 — Placeholder en .env.example | 2 min | Higiene de historial de git |
| 7 | M3 — Validación tipo/tamaño en uploads | 1 h | Requiere tocar 4 pantallas |

---

*Generado el 2026-08-04 — DuoMind Solutions / M.A.D.Y*
