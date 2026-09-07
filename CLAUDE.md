# CLAUDE.md — M.A.D.Y

Guía técnica para Claude Code. Léela antes de tocar cualquier archivo. Verificada contra el código real en septiembre 2026.

---

## 1. IDENTIDAD DEL PROYECTO

**Nombre visible:** M.A.D.Y (con puntos) · **Eslogan:** Inocuidad Inteligente
**Nombre técnico:** mady (repos, variables, slugs)
**Nombre anterior:** AgroCampo / HIMA (en proceso de renombrado)

**Qué es:** SaaS multi-tenant de gestión de inocuidad alimentaria, conforme al estándar PrimusGFS. Arquitectura multisector: campo, empacadora, cuarto frío, almacén, invernadero, exportadora, TIF/cárnicos y más. Cada organización accede solo a los módulos de los sectores que tiene contratados. Genera los formatos oficiales en PDF listos para auditoría.

**Empresa:** M.A.D.Y
**Desarrollador principal:** Saúl Luviano "Quyo"

**Marca:** Solo se usa "M.A.D.Y" en UI, PDFs y encabezados.
**Prohibido terminantemente:**
- "DuoMind" — en cualquier contexto: UI, PDFs, nombres de archivos, commits, comentarios
- "Inocuidad Digital" — eslogan viejo; el correcto es "Inocuidad Inteligente"
- Nombre de clientes/terceros — incluidos pero no limitados a "HIMA / Hima Inocuidad Alimentaria", "Frigo Plus / Frigoplus" o cualquier otra empresa

**Copyright:** siempre `© {año} M.A.D.Y` — sin co-autoría de terceros.

**Nombres de archivo de PDF:** Nunca incluir el nombre del rancho/instalación en el filename. Formato obligatorio: `${nombreModulo}-${fecha|mes}.pdf` (individual) o `${nombreModulo}-consolidado-${desde}-${hasta}.pdf` (consolidado). Sin slugs de terceros.

---

## 2. STACK Y HERRAMIENTAS

### App principal (`C:\Users\vongo\Documents\HIMA\hima`)

```
React            18.3.1 (peerDependency)
TypeScript       ~5 (devDependency, vía tsx y @vitejs/plugin-react)
Vite             6.3.5
Tailwind CSS     4.1.12  (@tailwindcss/vite — sin tailwind.config.ts, usa CSS custom properties)
shadcn/ui        40+ componentes (Radix UI primitivos + class-variance-authority)
React Router     7.13.0  (importar SIEMPRE de 'react-router', NUNCA de 'react-router-dom')
Supabase JS      2.105.4
@react-pdf/renderer 4.5.1   (PDFs individuales — componentes React)
pdf-lib          1.17.1      (merge/concatenación de múltiples PDFs en BibliotecaHistorial)
exceljs          4.4.0       (Excel client-side)
buffer           6.0.3       (polyfill manual para exceljs donde vite-plugin-node-polyfills no alcanza)
vite-plugin-node-polyfills   (devDependency — polyfill global de Buffer/process para exceljs y qrcode)
qrcode                       (dependencia — generación de QR para etiquetas LPT, M48)
@marsidev/react-turnstile 1.5.3  (Cloudflare Turnstile CAPTCHA en Login y Registro)
lucide-react     0.487.0
sonner           2.0.3
cmdk             1.1.1
motion           12.23.24
```

**Gestor de paquetes: `pnpm` SIEMPRE. Nunca `npm` ni `yarn`. Regla dura.**

**Comandos:**
```bash
pnpm install
pnpm run dev                      # localhost:5173
pnpm run build                    # dist/
pnpm run preview                  # verificar build antes de subir
pnpm run seed:aneberries          # seed zarzamora
pnpm run seed:aneberries:todos    # seed todos los cultivos
```

**Path alias:** `@` → `./src` (configurado en vite.config.ts)

**Helpers de lib propios:**
- `src/lib/fecha.ts` → `hoyMX(): string` — devuelve la fecha de hoy en zona horaria `America/Mexico_City` (formato `YYYY-MM-DD`). Usarlo **siempre** para capturar la fecha del día; nunca `new Date().toISOString().slice(0,10)`.
- `src/lib/codigoFormato.ts` → `codigoFormato(clave, codigoClave)` — adapta la clave del formato oficial (ej. `'F-FRUS-CAL-07'`) por organización.
- `src/lib/pdf/assets/logoMadyPdf.ts` → `LOGO_MADY_PDF` — isotipo M.A.D.Y como base64 embebido en PDFs.
- `src/lib/pdf/components/` → componentes PDF compartidos (ver sección PDFs).

**Nota:** `package.json` tiene `name: "@figma/my-make-file"` (scaffolding legacy de Figma Make, no refleja el proyecto actual).

---

### Landing (`C:\Users\vongo\Documents\HIMA\agrocampo-landing`)

Repo **separado**, proyecto Vercel **separado** (`inicio.mady.com.mx`). **No tocarla desde este repo.**

```
Next.js          16.2.9  (App Router)
React            19.2.4
TypeScript       ~5
Tailwind CSS     4.3.1
@phosphor-icons/react  2.1.10
@supabase/supabase-js  2.108.2
@vercel/analytics      2.0.1
motion           12.40.0
```

---

## 3. CÓMO TRABAJAR (GRAPHIFY — OBLIGATORIO)

El repo tiene un grafo de conocimiento en `graphify-out/`. **Consultarlo antes de abrir archivos fuente.**

```bash
# Navegar el código — ejemplos
graphify query "pantalla recuperacion contraseña auth"
graphify query "PDFs componentes compartidos encabezado"
graphify path "AuditoriaScreen" "m14_auditorias"
graphify explain "codigoFormato"

# Después de modificar código, actualizar el grafo
graphify update .
```

**Regla:** Primero `graphify query`, luego leer archivos solo si necesitas ver líneas específicas o editar. No explorar a ciegas con Glob/Grep cuando graphify puede responder en segundos.

---

## 4. BACKEND SUPABASE — SOLO CONSUMIR

**La base de datos la administra Saúl** (por MCP o Supabase Dashboard). Este repo **solo consume** lo que ya existe — no crea tablas, no modifica funciones SQL, no altera políticas RLS desde aquí. Si falta algo en la BD, **no tocarla: avisar a Saúl.**

### Multi-tenant estricto
Toda tabla de datos de cliente lleva `org_id NOT NULL` con política RLS que filtra por `get_my_org_id()`. `super_admin` tiene acceso cross-tenant. El **aislamiento es por ORGANIZACIÓN** (no por usuario individual).

### org_id — regla crítica
`org_id` NUNCA viene del input del usuario ni del frontend. Siempre del contexto de auth:

```typescript
const { profile } = useAuthContext()
// profile.org_id  ← única fuente válida

// En BD: auth.uid() / get_my_org_id() en políticas RLS
```

### RPCs y helpers a consumir

| RPC / Helper | Descripción |
|---|---|
| `get_mis_modulos()` | Menú dinámico. Incluye campo `desbloqueado: bool` (candado por módulo/upsell). |
| `get_mi_termino_sitio()` | Devuelve `'Rancho'` / `'Instalación'` / `'Sitio'` según sector. |
| `resolver_nfc_estacion(token)` | Resuelve un token NFC a su estación M21 + org. Usada en `/nfc/:token`. |
| `get_dashboard_resumen()` | Métricas para panel de instalaciones (Home). |
| `marcar_correccion(tabla, id, requiere, comentario)` | Marca registros para corrección por admin. |
| `completar_registro_organizacion(p_nombre_org)` | Alta de nueva org en plan `pendiente`. |

**Helper de clave de formato:**
```typescript
import { codigoFormato } from '@/lib/codigoFormato'
// Adapta 'F-FRUS-CAL-07' al código que corresponde a esta org
const codigo = codigoFormato('F-FRUS-CAL-07', codigoClave)
```

### Candado de fecha "solo hoy" (FECHA_SOLO_HOY)

Los triggers de BD (`FECHA_SOLO_HOY`) rechazan INSERT con fecha ≠ hoy en todos los módulos excepto M1 (Aplicaciones). M1 no tiene candado de fecha.

**Módulos afectados:** M7, M8, M10, M12, M13, M14–M18, M19 (columna día), M20, M21, M22, M23 (columna día), y módulos M24+.

**Patrón UI (ya implementado):**
```typescript
import { hoyMX } from '@/lib/fecha'
const esSuperAdmin = profile?.rol === 'super_admin'

// Input de fecha bloqueado para no-super_admin:
<input
  type="date"
  value={fecha}
  min={esSuperAdmin ? undefined : hoyMX()}
  max={esSuperAdmin ? undefined : hoyMX()}
  onChange={(e) => { if (esSuperAdmin) setFecha(e.target.value) }}
/>

// Captura del error en catch:
if (msg.includes('FECHA_SOLO_HOY')) {
  toast.warning('Solo puedes registrar con la fecha de hoy')
}
```

**Regla:** Si el módulo también tiene trigger de frecuencia (ej. `M7_LIMITE_QUINCENAL`), siempre chequear `FECHA_SOLO_HOY` **primero** en el if-chain.

### Secretos — nunca al frontend

| Variable | Dónde vive |
|----------|-----------|
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor/seeds, nunca Vite ni git |
| Stripe secret key (si se integra) | Solo servidor |
| `VITE_TURNSTILE_SITE_KEY` | Frontend OK (es pública) |
| `VITE_SUPABASE_ANON_KEY` | Frontend OK (es pública) |

---

## 5. DOMINIOS Y DEPLOY

### App
- **Deploy:** Vercel (proyecto `hima`)
- **Dominio principal:** `www.mady.com.mx` (la raíz `mady.com.mx` redirige a `www.mady.com.mx`)
- **Entorno:** producción en `mady-manual.vercel.app` (alias — el dominio real es `www.mady.com.mx`)

### Routing NFC — crítico, no romper
Los **chips NFC** físicos de las estaciones de plagas (M21) apuntan a:
```
https://mady.com.mx/nfc/<token>
```
La ruta `/nfc/:token` en `routes.tsx` debe **siempre existir** y estar fuera del guard de auth. El `vercel.json` tiene rewrite `/(.*) → /index.html` que la hace funcionar como SPA. **No romper este ruteo.**

```typescript
// routes.tsx — fuera de RequireAuth
{ path: "/nfc/:token", Component: NfcEstacion }
```

### Landing (repo separado)
- **Repo:** `C:\Users\vongo\Documents\HIMA\agrocampo-landing`
- **Dominio:** `inicio.mady.com.mx`
- **No tocar desde este repo.**

### vercel.json — CSP
El `Content-Security-Policy` incluye `wasm-unsafe-eval` (para `@react-pdf/renderer`), `blob:` y `data:` en varios src, y `frame-src challenges.cloudflare.com blob:` (Turnstile + PDF preview). Si agregas librerías que requieran nuevas fuentes, actualizar `vercel.json`.

---

## 6. AUTH Y CORREO

### SMTP transaccional
Supabase usa **Resend** para enviar correos de recuperación, invitación y confirmación desde el dominio `mady.com.mx`.

### Site URL de Supabase
Apunta a producción: `https://www.mady.com.mx`. Los links de recuperación en los correos redirigen ahí.

### Flujo de recuperación de contraseña (CONFIRMADO EN CÓDIGO)
1. Usuario pide restablecer → Supabase envía correo con link de recovery (vía Resend)
2. Al abrir el link, Supabase emite evento `PASSWORD_RECOVERY` en `onAuthStateChange`
3. `AuthContext` captura el evento y activa `isRecovery = true`
4. `RequireAuth` detecta `isRecovery` y navega a `/restablecer-contrasena`
5. `RestablecerContrasena.tsx` (`src/app/screens/RestablecerContrasena.tsx`) muestra el formulario de nueva contraseña y llama a `supabase.auth.updateUser({ password: nueva })`
6. Al completar, `clearRecovery()` y redirige a `/`

```typescript
// AuthContext expone:
const { user, loading, isRecovery, clearRecovery, signOut } = useAuthContext()
```

### Seguridad de login
- Cloudflare Turnstile CAPTCHA (`@marsidev/react-turnstile`) en Login y Registro
- Token de Turnstile se pasa a Supabase Auth en `signIn` y `signUp`
- Rate limiting configurable en Supabase

---

## 7. CONVENCIONES Y REGLAS DE ORO

### Formato PrimusGFS vs diseño
Cuando el formato oficial de PrimusGFS choca con "diseño más limpio", **manda el formato oficial**. M9 y M11 son matrices mensuales tipo calendario porque el auditor lo exige — no se simplifican.

### Firma del Responsable de Inocuidad en PDFs
Siempre en blanco para firmar a mano. Nunca se rellena programáticamente.

### Multi-tenant estricto
Ver sección 4 (Backend Supabase). `org_id` del auth context, nunca del input.

### RLS
Obligatorio en cualquier tabla nueva con datos de cliente. Inserts siempre propagan `org_id` desde el contexto de auth.

### Excel — polyfill requerido
`vite-plugin-node-polyfills` en `vite.config.ts` resuelve el `Buffer` global. En caso de módulos que lo necesiten en tiempo de ejecución de forma dinámica:
```typescript
if (!globalThis.Buffer) {
  const { Buffer } = await import('buffer')
  globalThis.Buffer = Buffer
}
```

### Diseño
- Mobile-first (390×844 px base), minimalista
- Sin sombras ni gradientes
- Navegación: barra inferior 5 tabs
- FAB: 56 px círculo, `bg-primary`, ícono blanco "+"
- Bottom sheet: 85% altura, handle bar, border-radius top 0.625 rem
- **NO hardcodear colores hex** — usar siempre las variables CSS del design system
- Iconos: `lucide-react` en la app

### Commits
Sin co-autoría de IA en el mensaje. Sin `Co-Authored-By`. En español.

---

## 8. PALETA DE MARCA

Fuente de verdad: `src/styles/theme.css`, bloque `@theme inline`.

```css
--primary:              #2B7AB5   /* Azul — botones, toggles activos, FAB */
--agro-blue:            #1E88C7   /* Azul secundario (hover) */
--background:           #F8F9FA
--card:                 #FFFFFF
--muted:                #ececf0   /* Fondos de sección header */
--muted-foreground:     #717182   /* Texto secundario / disabled */
--input-background:     #f3f3f5
--switch-background:    #cbced4   /* Toggle inactivo */
--border:               rgba(0,0,0,0.1)
--radius:               0.625rem

/* Semánticos */
--agro-success-fill:    #E3F2FD
--agro-success-text:    #0D5A8F
--agro-warning-fill:    #FAEEDA
--agro-warning-text:    #854F0B
--agro-danger-fill:     #FAECE7
--agro-danger-text:     #993C1D
--agro-red:             #C02A2A
--agro-amber:           #F5A623
```

**Tipografía:** Inter / Nunito Sans, weight 400/600.
**NO usar verde como color primario.**

**Logo M.A.D.Y:** M y A en `#2B7AB5`; D y Y en blanco sobre fondo oscuro / `#0D5A8F` sobre fondo claro. Componente: `src/app/components/MadyLogo.tsx` con variante light/dark.

**Favicon:** `public/favicon.ico` es el isotipo M.A.D.Y (no el genérico de Vite). **No revertirlo.**

---

## 9. PDFs — ESTÁNDAR HOMOGÉNEO

### Componentes compartidos (`src/lib/pdf/components/`)

Todos los módulos deben usar estos componentes. No duplicar lógica de layout en cada PDF.

| Archivo | Exporta |
|---|---|
| `tokens.ts` | `PC` — constantes de colores PDF (navyBar1, section, border, footerGray, etc.) |
| `PdfPage.tsx` | `TopBar`, `PdfPageFrame`, `PdfFooter` |
| `PdfHeader.tsx` | Encabezado estándar con logo isotipo embebido |
| `PdfTable.tsx` | Tabla estándar |
| `PdfSectionBanner.tsx` | Banda de sección con color |
| `PdfMonthlyMatrix.tsx` | Matriz mensual tipo calendario (M9, M11, M19, M23, etc.) |
| `PdfFieldGrid.tsx` | Grid de campos de datos generales |
| `PdfChecklist.tsx` | Lista de verificación con marcas |
| `PdfSignatures.tsx` | Líneas de firma en blanco |
| `PdfLegend.tsx` | Leyenda de códigos al pie |

**Assets:**
- `src/lib/pdf/assets/logoMadyPdf.ts` → `LOGO_MADY_PDF` (isotipo como base64)

### Pie de página estándar (PdfFooter)
```
[código del formato]          M.A.D.Y. | Gestión inteligente para la inocuidad          Página X de Y
```

### Restricciones técnicas
- Fuente: Helvetica (built-in, sin carga externa)
- **Sí se usan** acentos (á, é, í, ó, ú) y ñ — Helvetica los soporta correctamente
- **No usar** símbolos Unicode especiales (✓, ✗, →) — usar texto ('Si', 'No', 'N/A', 'X', etc.)
- `@react-pdf/renderer` para páginas individuales
- `pdf-lib` solo para concatenar múltiples blobs en BibliotecaHistorial (`mergePDFBlobs`)
- **Sin "DuoMind"** en ningún PDF

### Patrón de archivos PDF por módulo
```
src/lib/pdf/m<N>/
  ├── <Modulo>PDF.tsx                       ← componente @react-pdf/renderer
  ├── generar<Modulo>PDF.tsx               ← descarga individual
  └── generar<Modulo>ConsolidadoPDF.tsx    ← consolidado por rango de fechas
```

---

## 10. MOTOR DE AUDITORÍAS PRIMUSGFS — EN PAUSA

**Situación actual:**

En Supabase existen las tablas del motor unificado (`aud_*`) con el catálogo de preguntas cargado. **PERO** las auditorías M14–M18 **siguen usando sus propias tablas** (`m14_auditorias`, `m14_respuestas`, ..., `m18_auditorias`, `m18_respuestas`) y **así deben quedar por ahora**.

**Regla crítica:** El motor `aud_*` está **EN PAUSA / separado**. No está conectado a M14–M18. **No** reemplazar M14–M18 por el motor unificado sin indicación expresa de Saúl. Ya ocurrió una vez — se ocultaron auditorías históricas y hubo que hacer un revert. El antecedente está en el historial de git (`031e2bc`).

**Estado en código:**
- M14–M18 usan `useAuditoria(modulo)` → consulta `mXX_auditorias` / `mXX_respuestas`
- `AuditoriaScreen` / `AuditoriaPDF` / `generarAuditoriaPDF` son el motor compartido actual (correcto, no tocar)
- `AuditoriasPrimusGFS.tsx` (`/inocuidad/auditorias-primusgfs`) es una pantalla nueva — verificar con graphify antes de modificar

---

## 11. MÓDULOS DE INOCUIDAD

### Patrón común (M6 es la referencia canónica)

```
src/hooks/use<Modulo>.ts                    ← fetch Supabase, filtra por profile.org_id
src/lib/pdf/m<N>/
  ├── <Modulo>PDF.tsx
  ├── generar<Modulo>PDF.tsx
  └── generar<Modulo>ConsolidadoPDF.tsx
src/app/screens/<Modulo>.tsx               ← pantalla completa
```

**Flujo estándar de pantalla:**
1. Header con ChevronLeft + título + ícono
2. Botón "Exportar consolidado" → bottom sheet con selector de fechas
3. Lista de registros como cards con chip de estado + botón PDF individual
4. FAB (+) → bottom sheet formulario (85% altura)
5. Validación de rancho + prevención proactiva del límite de frecuencia (banner ámbar)
6. Guardar → INSERT con `org_id` del auth → refetch → generar PDF → try/catch con toast

**Restricciones de frecuencia:** Viven en triggers Postgres + prevención proactiva en UI.
Patrón de captura: `mensaje.includes('<NOMBRE_TRIGGER>')` → `toast.warning(parsearErrorLimite(mensaje), { duration: 7000 })`

---

### M1 — Nueva Aplicación (plaguicidas)

**Tabla:** `aplicaciones` + `aplicacion_productos`
**Ruta:** `/nueva-aplicacion`
**Formulario:** 4 pasos — Parcela/cultivo → Productos → Aplicación/agua → Cierre

**Fórmulas de cálculo (todas a 4 decimales con `r4 = parseFloat(n.toFixed(4))`):**
```typescript
cloro_cantidad_l = r4(5 * (total_agua_l / 200))   // si cloracion=true
total_producto = r4(dosis_ha * superficie_ha)
dosis_200l = r4((dosis_ha / (total_agua_l / 200)) * superficie_ha)
```

**Flujo al guardar:**
1. INSERT en `aplicaciones`
2. INSERT en `aplicacion_productos`
3. `registrarSalidasAplicacion` — descuenta inventario (fire-and-forget)
4. Genera PDF automáticamente (A4 landscape)

**Catálogo ANEBERRIES:** Global, sin `org_id`. 723 productos, 7 categorías, 4 cultivos.

---

### M2 — Inventario

**Rutas:** `/inventario`
**Vistas SQL:** `v_inventario_saldo_rancho`, `v_inventario_saldo_productor`
**Salida automática desde M1:** permite saldo negativo (se muestra en rojo)

---

### M3 — Biblioteca / Historial

**Ruta:** `/historial` → `BibliotecaHistorial.tsx`
**Funcionalidad "Exportar paquete PDF":**
- Genera blobs individuales con `generarBlobParaRef()` → concatena con `mergePDFBlobs()` (pdf-lib)
- Los chips de "Módulos" se derivan de `useModulosContext()`, NO de una lista fija
- Tipos de referencia: `PDFRef` con discriminante por `tipo: ModuloKey`

**Excel:** desde `DetalleAplicacion.tsx`, exporta la aplicación con 2 hojas.

---

### M6 — Botiquín de Primeros Auxilios

**Tabla:** `m6_botiquin` | **Ruta:** `/inocuidad/botiquin` | **Frecuencia:** Semanal
**Trigger BD:** `BOTIQUIN_LIMITE_SEMANAL`

---

### M7 — Inspección de Vidrio y Plástico Duro

**Tablas:** `m7_vidrio_plastico`, `m7_materiales_rancho`
**Ruta:** `/inocuidad/vidrio-plastico` | **Frecuencia:** Quincenal (14 días)
**Trigger BD:** `M7_LIMITE_QUINCENAL`
**Diferencia clave:** 1 inspección = N filas (misma fecha + rancho). Hook agrupa por `rancho_id + fecha`.

---

### M8 — Registro de Fertilización

**Tabla:** `m8_fertilizacion` | **Ruta:** `/inocuidad/fertilizacion` | **Frecuencia:** Por evento
**Tablas auxiliares:** `fertilizantes_org`, `inventario_fertilizantes`

---

### M9 — Monitoreo Perimetral

**Tablas:** `m9_registro_mensual`, `m9_dias_inspeccion`, `m9_resultados`, `m9_items_catalogo`
**Ruta:** `/inocuidad/perimetral` | **Frecuencia:** Semanal
**Formato PDF:** Matriz mensual tipo calendario (PrimusGFS lo exige — no simplificar)

---

### M10 — Cosecha y Liberación

**Tabla:** `m10_cosecha_liberacion` | **Ruta:** `/inocuidad/cosecha` | **Frecuencia:** Por evento
**Verificación de intervalo de seguridad:** Consulta M1 para dias_cosecha; advertencia ámbar (no bloquea)

---

### M11 — Preoperacional de Cosecha

**Tablas:** `m11_registro_mensual`, `m11_dias_inspeccion`, `m11_resultados`, `m11_items_catalogo`
**Ruta:** `/inocuidad/preoperacional` | **Frecuencia:** Diaria
**Formato PDF:** Matriz mensual tipo calendario (PrimusGFS lo exige — no simplificar)
**Resultado por ítem:** 'SI' | 'NO' | 'NA' + codigo_correctivo

---

### M12 — Limpieza de Baños

**Tabla:** `m12_limpieza_banos` | **Ruta:** `/inocuidad/limpieza-banos` | **Frecuencia:** Por evento

---

### M13 — Reporte de Incidencias

**Tabla:** `m13_reportes` + `m13_incidencias` | **Ruta:** `/inocuidad/incidencias` | **Frecuencia:** Por evento
**Almacenamiento de fotos:** Supabase Storage, bucket privado `incidencias` (RLS por org_id)

---

### M14 — Auditoría SAIA (PrimusGFS M1)

**Ruta:** `/inocuidad/auditoria-saia`
**Pantalla:** `AuditoriaSaia.tsx` → wrapper de `AuditoriaScreen` genérico con `modulo="m14"`
**Tablas BD propias:** `m14_auditorias`, `m14_respuestas` — **no migrar al motor aud_***

---

### M15 — Auditoría Granja (PrimusGFS M2 BPA)

**Ruta:** `/inocuidad/auditoria-granja` | **Sector:** campo
**Tablas BD propias:** `m15_auditorias`, `m15_respuestas`

---

### M16 — Auditoría Cuadrilla de Cosecha (PrimusGFS M4 BPA)

**Ruta:** `/inocuidad/auditoria-cosecha` | **Sector:** campo
**Tablas BD propias:** `m16_auditorias`, `m16_respuestas`

---

### M17 — BPM's: Buenas Prácticas de Manufactura (PrimusGFS M5)

**Ruta:** `/inocuidad/bpm`
**Sectores:** Empacadora, Exportadora, Almacén, Cuarto Frío
**Tablas BD:** `m17_secciones`, `m17_preguntas`, `m17_auditorias`, `m17_respuestas`
**Catálogo:** 18 secciones / 165 preguntas / 1,369 pts máx.
**Portada JSONB:** `PortadaBPM` tipo, componente `PortadaBPMForm.tsx`

---

### M18 — HACCP (PrimusGFS M6)

**Ruta:** `/inocuidad/haccp`
**Sectores:** Empacadora, Cuarto Frío, Exportadora, TIF/Cárnicos
**Tablas BD:** `m18_secciones`, `m18_preguntas`, `m18_auditorias`, `m18_respuestas`
**Catálogo:** 3 secciones / 22 preguntas / 265 pts máx. — **no tocar desde frontend**
**Sin portada:** campo `portada` JSONB existe pero no se usa (acepta `null`)

---

### M19 — Inspección Pre-operacional Cooler (F-FRUS-CAL-07)

**Ruta:** `/inocuidad/inspeccion-preoperacional` | **Sector:** Cuarto Frío | **Frecuencia:** Diaria
**Tablas BD:** `m19_registro_mensual`, `m19_dias_inspeccion`, `m19_resultados`, `m19_items_catalogo`
**Valores:** `'SI'` / `'NO'` / `'NA'`
**Vinculación M13:** marcar NO con descripción → crea `m13_reportes` + `m13_incidencias` automáticamente

---

### M20 — Accidentes Laborales (F-FRUS-CAL-15)

**Ruta:** `/inocuidad/accidentes` | **Sector:** Cuarto Frío | **Frecuencia:** Por evento
**Tablas BD:** `m20_accidentes`, `m20_accidente_fotos`
**Storage:** bucket `incidencias`, path `{org_id}/m20/{id}/{uuid}.jpg`
**Rollback:** DELETE accidente + borrar fotos en error

---

### M21 — Monitoreo de Estaciones de Plagas (F-FRUS-CAL-19)

**Ruta:** `/inocuidad/monitoreo-plagas` | **Sector:** Cuarto Frío | **Frecuencia:** Por evento
**Tablas BD:** `m21_estaciones`, `m21_estado_trampa`, `m21_condiciones`, `m21_plagas`, `m21_revision`, `m21_resultado`
**NFC:** Los chips físicos apuntan a `mady.com.mx/nfc/<token>` → `NfcEstacion.tsx` → RPC `resolver_nfc_estacion(token)`
**Tipos de trampa:** `'cebo'` | `'interior'` | `'mecanica'` | `'luz'`

---

### M22 — Muestras al Laboratorio (F-FRUS-CAL-24)

**Ruta:** `/inocuidad/muestras-laboratorio` | **Sector:** Cuarto Frío | **Frecuencia:** Por evento
**Tablas BD:** `m22_microorganismos`, `m22_muestras`

---

### M23 — Verificación de Insumos (F-FRUS-SAN-01)

**Ruta:** `/inocuidad/verificacion-insumos` | **Sector:** Cuarto Frío | **Frecuencia:** Diaria
**Tablas BD:** `m23_insumos`, `m23_registro_mensual`, `m23_dias_inspeccion`, `m23_resultados`
**Plantilla estándar:** 30 ítems (Baño H/M, Aduana, Recepción, Comedor, Oficinas, Botiquín)
**Vinculación M13:** igual que M19 (NO con descripción → crea incidencia)

---

### M24+ — Módulos adicionales

Los módulos M24 en adelante están implementados y en producción. Se documentarán en detalle conforme se estabilicen. Lista de rutas activas en `routes.tsx`:

| Ruta | Pantalla | M# PDF |
|------|----------|--------|
| `/inocuidad/inventario-quimicos` | ControlInventarioQuimicos | M24 |
| `/inocuidad/no-conformidades` | ResumenNoConformidades | M25 |
| `/inocuidad/acciones-correctivas` | AccionesCorrectivas | M26 |
| `/inocuidad/preparacion-cloro` | PreparacionCloro | M27 |
| `/inocuidad/limpieza-banos-quimicos` | LimpiezaBanosQuimicos | M28 |
| `/inocuidad/limpieza-aduana` | LimpiezaAduana | M29 |
| `/inocuidad/limpieza-comedor` | LimpiezaComedor | M30 |
| `/inocuidad/limpieza-oficinas` | LimpiezaOficinas | M31 |
| `/inocuidad/limpieza-patios-azoteas` | LimpiezaPatiosAzoteas | M32 |
| `/inocuidad/limpieza-recepcion` | LimpiezaRecepcion | M33 |
| `/inocuidad/limpieza-preenfrio-conservador` | LimpiezaPreenfrio | M34 |
| `/inocuidad/limpieza-almacen-empaque` | LimpiezaAlmacenEmpaque | M35 |
| `/inocuidad/monitoreo-germicida` | MonitoreoGermicida | M36 |
| `/inocuidad/limpieza-cisterna` | LimpiezaCisterna | M37 |
| `/inocuidad/manifiesto-embarque` | ManifiestoEmbarque | M38 |
| `/inocuidad/recepcion-fruta` | RecepcionFruta | M39 |
| `/inocuidad/entradas-salidas-prefrio` | EntradasSalidasPreFrio | M40 |
| `/inocuidad/temperaturas-conservador` | TemperaturasConservador | M41 |
| `/inocuidad/material-empaque-movimientos` | MaterialEmpaqueMovimientos | M42 |
| `/inocuidad/inspeccion-almacen-empaque` | InspeccionAlmacenEmpaque | M43 |
| `/inocuidad/orden-mantenimiento` | OrdenMantenimiento | M44 |
| `/inocuidad/mantenimiento-preventivo` | MantenimientoPreventivo | M45 |
| `/inocuidad/rondines-vigilancia` | RondinesVigilancia | M46 |
| `/inocuidad/registro-personal` | RegistroPersonal | M47 |
| `/inocuidad/trazabilidad` | TrazabilidadProducto | M48 |

**Verificar con graphify** antes de modificar cualquier módulo M24+.

---

## 12. ARQUITECTURA MULTISECTOR

### Principio fundamental
La app es data-driven: los módulos que ve cada usuario los determina la BD, no el frontend. El frontend solo pinta lo que recibe de `get_mis_modulos()`.

### Tablas de catálogo global
```
sectores_catalogo          — sectores disponibles
modulos_catalogo           — todos los módulos (código, nombre, ruta, ícono, orden, mostrar_en_menu)
modulo_sectores            — qué módulos pertenecen a qué sector
```

### Tablas de habilitación por organización (write solo super_admin)
```
organizacion_sectores      — sectores habilitados para cada org
perfil_sectores            — sectores asignados a cada usuario dentro de su org
```

### RPC get_mis_modulos()
Única fuente del menú de inocuidad. Tipo de retorno:
```typescript
interface ModuloVisible {
  codigo: string           // 'M6', 'M13', ...
  clave: string            // 'botiquin', 'incidencias', ...
  nombre: string
  ruta: string
  icono: string
  orden: number
  es_transversal: boolean
  mostrar_en_menu: boolean // false = vive en barra inferior
  sector_clave: string | null
  sector_nombre: string | null
  sector_orden: number | null
  desbloqueado: boolean    // false = módulo bloqueado/upsell
}
```

### Clasificación de módulos por sector
| Sector | Módulos |
|--------|---------|
| **Transversales** | M3, M6, M13, M14 |
| **Campo** | M1, M2, M7, M8, M9, M10, M11, M12, M15, M16 |
| **Empacadora / Exportadora / Cuarto Frío / TIF-Cárnicos** | M17, M18 |
| **Cuarto Frío** (adicional) | M19–M48 (en expansión) |
| **Almacén** | M17 |

### Término de sitio dinámico
`get_mi_termino_sitio()` → `'Rancho'` / `'Instalación'` / `'Sitio'`
Hook: `src/hooks/useTerminoSitio.ts` + helper `resolverTerminos(termino)`
Expuesto vía `ModulosContext` como `terminosSitio: TerminosSitio`

### Implementación frontend
- **Hook:** `src/hooks/useMisModulos.ts` — `{ modulos, loading, error, refetch, clear }`
- **Contexto:** `src/context/ModulosContext.tsx` — `ModulosProvider` envuelve la app
- **Mapa de íconos:** `src/app/components/iconos-modulos.ts` — `resolverIcono(nombre)`
- **Guard de ruta:** `src/app/components/RequireModulo.tsx` — padre de `/inocuidad/*`
- **Home:** filtra por `mostrar_en_menu === true`; agrupa por sector con subheaders

---

## 13. MODELO DE DATOS Y SEGURIDAD

### Roles
```
super_admin     → M.A.D.Y (acceso cross-tenant)
admin_org       → Admin de su organización
asesor_tecnico  → Supervisión y recomendaciones
operario        → Solo sus propios registros
```

### Planes de organización
| Plan | Límite ranchos |
|------|---------------|
| `pendiente` | 0 |
| `basico` | 5 |
| `personalizado` | sin límite |
| `free` | sin límite (uso interno) |

**Trigger BD:** `LIMITE_RANCHOS_PLAN` — bloquea crear rancho si se supera el límite.

### Tabla `organizaciones`
```
id, nombre, tipo, plan, estado, admin_edita_ajenos (bool)
```

### Tabla `profiles`
```
id (= auth.user.id), nombre_completo, rol, org_id (nullable), activo
```

### Funcionalidad de equipos
- `admin_org` ve todos los registros de su org
- Puede editar registros ajenos solo si `organizaciones.admin_edita_ajenos = true`
- Pantalla: `/equipo/actividad` → `ActividadEquipo.tsx`

### Flujo de registro de nuevo usuario
1. Registro email/password → Supabase crea `auth.user`
2. Trigger `on_auth_user_created` crea `profile` con `org_id = null`
3. App detecta `profile.org_id IS NULL` → `RequireOrg` redirige a `/completar-organizacion`
4. RPC `completar_registro_organizacion(p_nombre_org)` → crea org en plan `pendiente`, asigna como `admin_org` (atómico)

---

## 14. ESTRUCTURA DEL CÓDIGO

```
src/
├── main.tsx
├── app/
│   ├── App.tsx                             # AuthProvider → ModulosProvider → RouterProvider
│   ├── routes.tsx                          # createBrowserRouter
│   ├── screens/                            # 50+ pantallas page-level (y creciendo)
│   └── components/
│       ├── Layout.tsx
│       ├── RequireAuth.tsx / RequireOrg.tsx / RequireModulo.tsx
│       ├── iconos-modulos.ts
│       ├── MadyLogo.tsx
│       └── ui/                            # 40+ componentes shadcn/ui
├── context/
│   ├── AuthContext.tsx                    # signIn, signOut, signUp, isRecovery, clearRecovery
│   └── ModulosContext.tsx
├── hooks/
│   ├── useAuth.ts / useMisModulos.ts / useTerminoSitio.ts
│   ├── useRanchos.ts / useCatalogoProductos.ts
│   └── use<ModuloXX>.ts (por cada módulo)
├── lib/
│   ├── supabase.ts                         # createClient, storageKey: 'agrocampo-auth'
│   ├── queries.ts                          # 20+ funciones CRUD
│   ├── fecha.ts                            # hoyMX(): string (zona America/Mexico_City)
│   ├── codigoFormato.ts                    # codigoFormato(clave, codigoClave)
│   ├── pdf/
│   │   ├── components/                     # Componentes PDF compartidos (ver sección 9)
│   │   ├── assets/                         # logoMadyPdf.ts (base64)
│   │   ├── generarPDF.tsx                  # Descarga M1
│   │   ├── generarBlobHistorial.tsx        # Blobs por módulo + mergePDFBlobs
│   │   ├── AplicacionPDF.tsx / MadyLogoPDF.tsx
│   │   ├── auditoria/                      # Motor compartido M14–M18
│   │   └── m6/ ... m48/                    # PDFs por módulo
│   └── excel/
│       └── generarExcelHistorial.ts
├── types/
│   └── database.types.ts                  # Tipos TypeScript completos — fuente de verdad
├── styles/
│   ├── theme.css                           # CSS custom properties + @theme inline (Tailwind v4)
│   ├── tailwind.css
│   └── fonts.css
└── scripts/
    └── seed-aneberries-*.ts
```

### Rutas principales

| Ruta | Pantalla |
|------|----------|
| `/login` | Login (con Turnstile) |
| `/registro` | Registro |
| `/restablecer-contrasena` | RestablecerContrasena (flujo PASSWORD_RECOVERY) |
| `/nfc/:token` | NfcEstacion (fuera de auth — NO proteger) |
| `/completar-organizacion` | CompletarOrganizacion |
| `/` | Home |
| `/nueva-aplicacion` | M1 |
| `/inventario` | M2 |
| `/historial` | BibliotecaHistorial (M3) |
| `/historial/:id` | DetalleAplicacion |
| `/inocuidad/auditorias-primusgfs` | AuditoriasPrimusGFS |
| `/inocuidad/botiquin` | M6 |
| `/inocuidad/vidrio-plastico` | M7 |
| `/inocuidad/fertilizacion` | M8 |
| `/inocuidad/perimetral` | M9 |
| `/inocuidad/cosecha` | M10 |
| `/inocuidad/preoperacional` | M11 |
| `/inocuidad/limpieza-banos` | M12 |
| `/inocuidad/incidencias` | M13 |
| `/inocuidad/auditoria-saia` | M14 |
| `/inocuidad/auditoria-granja` | M15 |
| `/inocuidad/auditoria-cosecha` | M16 |
| `/inocuidad/bpm` | M17 |
| `/inocuidad/haccp` | M18 |
| `/inocuidad/inspeccion-preoperacional` | M19 |
| `/inocuidad/accidentes` | M20 |
| `/inocuidad/monitoreo-plagas` | M21 |
| `/inocuidad/muestras-laboratorio` | M22 |
| `/inocuidad/verificacion-insumos` | M23 |
| `/inocuidad/inventario-quimicos` | M24 |
| `/inocuidad/no-conformidades` | M25 |
| `/inocuidad/acciones-correctivas` | M26 |
| `/inocuidad/preparacion-cloro` | M27 |
| `/inocuidad/limpieza-banos-quimicos` | M28 |
| `/inocuidad/limpieza-aduana` | M29 |
| ...y más (ver sección 11) | M30–M48 |

---

## 15. GOTCHAS CONOCIDOS

| Problema | Causa | Solución |
|---|---|---|
| `Buffer is not defined` en runtime | exceljs / qrcode necesitan Node polyfills | `vite-plugin-node-polyfills` en `vite.config.ts`; o polyfill manual con `import('buffer')` |
| PDF bloqueado por CSP | `@react-pdf/renderer` usa `blob:` y `wasm-unsafe-eval` | Ya está en `vercel.json`; no quitarlo |
| Imprimir PDF no funciona | Usar `window.print()` directo abre diálogo del navegador en la página, no en el PDF | Usar un iframe oculto que carga la URL del blob y llama `iframe.contentWindow.print()` |
| Modal no se cierra / doble render | Manipular el DOM directamente (`document.body.appendChild`) | Usar siempre estado React y refs para modales y sheets |
| Turnstile no aparece en dev | `VITE_TURNSTILE_SITE_KEY` no configurado | Copiar del `.env.example` o de Vercel dashboard |
| Sesión duplicada / cuelgue infinito al recargar | Múltiples instancias de `createClient` | `supabase.ts` es la única fuente — `storageKey: 'agrocampo-auth'` único |

---

## 16. FLUJO CON SAÚL

Saúl define la necesidad y deja la BD lista (tablas, RPCs, triggers, RLS). Este repo hace el frontend consumiendo lo que ya existe.

**Proceso normal:**
1. Saúl crea las tablas/funciones en Supabase (vía MCP o Dashboard)
2. Saúl actualiza `database.types.ts` o lo genera con `supabase gen types`
3. Se implementa la pantalla en el frontend consumiendo las RPCs/tablas

**Si algo falta en la BD:** No inventar workarounds en el frontend. Avisar a Saúl y esperar.

**Deploy:** `pnpm run build` debe pasar limpio. Vercel despliega automáticamente al hacer push a `main`. Verificar siempre con `pnpm run build && pnpm run preview` antes de hacer push.

---

## 17. ESTADO DEL DESARROLLO

### Producción
- **App:** `www.mady.com.mx` (Vercel, proyecto `hima`)
- **Landing:** `inicio.mady.com.mx` (repo `agrocampo-landing`, proyecto Vercel separado)

### Módulos — estado verificado

| Módulo | Estado |
|--------|--------|
| M1 Aplicaciones | ✅ Completo |
| M2 Inventario | ✅ Completo |
| M3 Historial / Biblioteca | ✅ Completo |
| M6 Botiquín | ✅ Completo |
| M7 Vidrio/Plástico | ✅ Completo |
| M8 Fertilización | ✅ Completo |
| M9 Perimetral | ✅ Completo |
| M10 Cosecha/Liberación | ✅ Completo |
| M11 Preoperacional | ✅ Completo |
| M12 Limpieza Baños | ✅ Completo |
| M13 Reporte de Incidencias | ✅ Completo |
| M14 Auditoría SAIA | ✅ Completo |
| M15 Auditoría Granja | ✅ Completo |
| M16 Auditoría Cuadrilla | ✅ Completo |
| M17 BPM's | ✅ Completo |
| M18 HACCP | ✅ Completo |
| M19 Inspección Pre-operacional Cooler | ✅ Completo |
| M20 Accidentes Laborales | ✅ Completo |
| M21 Monitoreo de Plagas | ✅ Completo |
| M22 Muestras al Laboratorio | ✅ Completo |
| M23 Verificación de Insumos | ✅ Completo |
| M24–M48 (ver sección 11) | ✅ Implementados (en consolidación) |
| Auth recovery / RestablecerContrasena | ✅ Completo |
| NFC (chips M21) | ✅ Completo |
| Menú dinámico multisector | ✅ Funcional |
| Equipos multi-usuario | ✅ Funcional |
| Límites de plan + bloqueo de ranchos | ✅ Funcional |
| CAPTCHA Turnstile | ✅ Funcional |
| PDFs con estándar homogéneo | ✅ Funcional (componentes compartidos en src/lib/pdf/components/) |

### Pendientes técnicos

1. **Sistema de invitación de empleados** — flujo de invitación por email no implementado; admin agrega usuarios manualmente.
2. **Webhook de Stripe** — pagos con Payment Links externos; activación de plan manual. Falta webhook automático.
3. **Stripe** — no está integrado en el código de la app.
4. **Renombrar repos y proyectos** — GitHub `saul6/HIMA` → mady; actualizar hostnames en Turnstile; renombrar `storageKey: 'agrocampo-auth'` en `supabase.ts`.
5. **Supabase plan Pro** — subir al primer cliente real.
6. **Tests** — no configurados.
7. **Soporte offline** — no implementado.

---

## 18. BUGS RESUELTOS (historial relevante)

### Recarga de página colgaba infinitamente
**Causa:** `onAuthStateChange` disparaba `SIGNED_IN` al recuperar sesión, generando múltiples instancias de `GoTrueClient`.
**Solución:** `storageKey: 'agrocampo-auth'` único en `supabase.ts`; estrategia mixta `getSession()` al montar + `onAuthStateChange` solo para eventos nuevos.

### Crash en DetalleAplicacion al abrir un registro
**Causa:** `AplicacionRica` es un tipo flat — `app.aplicacion.status` → `undefined` → TypeError.
**Solución:** `const a = app` (en lugar de `const a = app.aplicacion`).

### Auditorías históricas ocultas tras migración al motor aud_*
**Causa:** Intento de migrar M14–M18 al motor unificado `aud_*` sin conservar los datos de las tablas propias.
**Solución:** Revert completo (`031e2bc`). Motor nuevo queda en pausa — M14–M18 usan sus tablas propias.

---

## 19. SKILLS DE DISEÑO INSTALADAS

En `.claude/skills/` y `.agents/skills/`:
- `emil-design-eng` — filosofía de polish UI y detalles invisibles
- `impeccable` — auditoría y mejora de interfaces
- `design-taste-frontend` — landing pages, rediseños, anti-slop

Usarlas con `/skill-name` cuando se requiera trabajo de diseño.

---

## 20. RUTAS Y RECURSOS

### Repositorios locales
- **App:** `C:\Users\vongo\Documents\HIMA\hima` (rama `main`)
- **Landing:** `C:\Users\vongo\Documents\HIMA\agrocampo-landing`

### Supabase
- **Proyecto activo:** `glrjesvtsspilkacooln`
- **URL:** `https://glrjesvtsspilkacooln.supabase.co`
- **Proyecto anterior (obsoleto/pausado):** `yntpbchpjjydswooyast`

### Variables de entorno

**App (Vite — solo nombres, nunca los valores en git):**
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_TURNSTILE_SITE_KEY
SUPABASE_SERVICE_ROLE_KEY   ← solo para scripts/seeds locales, NUNCA al frontend
```

---

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

---

*Última actualización: septiembre 2026 — M.A.D.Y · Inocuidad Inteligente*
