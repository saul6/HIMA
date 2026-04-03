# CLAUDE.md — AgroCampo / Proyecto Hima

Este archivo provee contexto completo a Claude Code sobre el proyecto, el cliente, el stack técnico, los acuerdos comerciales y las decisiones de diseño tomadas. Léelo completo antes de tocar cualquier archivo.

---

## 1. Contexto del negocio

**Cliente:** Hima Inocuidad Alimentaria — empresa de consultoría y certificación en inocuidad alimentaria que gestiona el cumplimiento regulatorio de más de 200 productores agrícolas del sector berry en México. Su cliente principal es **Hortifrut**, empresa exportadora de berries (zarzamora, fresa, arándano, frambuesa) que exporta a EUA, Europa y Asia.

**Problema que resuelve AgroCampo:** Hima gestiona actualmente los registros de aplicaciones de agroquímicos de 200+ productores en formatos físicos en papel o Excel que se envían por WhatsApp/correo. No existe centralización, trazabilidad en tiempo real ni capacidad de búsqueda rápida ante auditorías de GlobalGAP, USDA o SENASICA.

**Relación comercial:** DuoMind Solutions y Hima Inocuidad Alimentaria tienen firmado un **Convenio de Asociación en Participación** (conforme a los Arts. 252-259 del Código de Comercio mexicano). El desarrollo de AgroCampo es un proyecto conjunto:
- Hima cubre los gastos variables de desarrollo (licencias, infraestructura, herramientas)
- DuoMind aporta el capital intelectual y el desarrollo
- Distribución de beneficios Fase 1: 60% Hima / 40% DuoMind
- Distribución de beneficios Fase 2 (post-recuperación de inversión): 50% / 50%

**Desarrolladores:**
- Luviano Sánchez Saúl
- Medina Moreno Moisés
- Empresa: DuoMind Solutions
- Régimen fiscal: RESICO

---

## 2. Stack técnico

```
Frontend:    React + TypeScript + Vite
Estilos:     Tailwind CSS + shadcn/ui
Base datos:  Supabase (PostgreSQL + Auth + Storage + RLS)
Hosting:     DigitalOcean (App Platform o Droplet con Docker)
Generación PDF: puppeteer o pdf-lib (server-side)
Gestor paquetes: pnpm (pnpm-workspace.yaml presente)
```

**Variables de entorno necesarias:**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

**Comandos:**
```bash
cd "AgroCampo pesticide management app"
pnpm install        # NO usar npm, el proyecto usa pnpm
pnpm run dev        # Corre en localhost:5173
pnpm run build      # Build de producción
```

---

## 3. Diseño y paleta de colores

El diseño es **mobile-first** (390×844px base), minimalista, sin sombras ni gradientes. La navegación usa una **barra inferior** con 5 tabs.

### Tokens CSS (usar siempre estas variables, nunca hardcodear hex):

```css
--primary:              #2B7AB5   /* Azul principal — botones, toggles activos, FAB */
--agro-blue:            #1E88C7   /* Azul secundario */
--agro-red:             #C02A2A   /* Destructivo / alertas críticas */
--agro-amber:           #F5A623   /* Advertencias */
--background:           #F8F9FA   /* Fondo de la app */
--card:                 #FFFFFF   /* Superficies / cards */
--muted:                #ececf0   /* Fondos de sección header, banners informativos */
--muted-foreground:     #717182   /* Texto secundario / auto-filled / deshabilitado */
--input-background:     #f3f3f5   /* Fondo de inputs */
--switch-background:    #cbced4   /* Toggle inactivo */
--border:               rgba(0,0,0,0.1)  /* Bordes */
--radius:               0.625rem  /* Border radius base */

/* Semánticos */
--agro-success-fill:    #E3F2FD   /* Fondo success/info */
--agro-success-text:    #0D5A8F   /* Texto sobre success fill */
--agro-warning-fill:    #FAEEDA   /* Fondo advertencia */
--agro-warning-text:    #854F0B   /* Texto sobre warning fill */
--agro-danger-fill:     #FAECE7   /* Fondo peligro */
--agro-danger-text:     #993C1D   /* Texto sobre danger fill */
```

### Reglas de diseño:
- Fuente: Inter o Nunito Sans — weight 400 (normal) y 600 (medium)
- NO usar verde como primario — el primario es azul #2B7AB5
- Toggles activos: --primary (#2B7AB5) / Inactivos: --switch-background (#cbced4)
- Status chips: Al día (#E3F2FD / #0D5A8F) · Pendiente (#FAEEDA / #854F0B) · Vencido (#FAECE7 / #993C1D)
- FAB: 56px círculo, background #2B7AB5, ícono blanco "+"
- Bottom sheet: 85% altura, handle bar arriba, border-radius top 0.625rem

---

## 4. Arquitectura de roles y usuarios

```
super_admin     → DuoMind Solutions (acceso total)
admin_hima      → Equipo Hima Inocuidad Alimentaria (panel de todos los productores)
asesor_tecnico  → Luis Ignacio Rosales Guerrero y otros asesores (recomendaciones, supervisión)
operario        → Productor de campo (Carlos Alvarez N., Alejandro Lucatero S. y 200+ más)
```

**Seguridad:** Row Level Security (RLS) en Supabase. Cada operario solo ve sus propios registros. admin_hima ve todos. Las políticas RLS deben implementarse a nivel de base de datos, no solo en el frontend.

---

## 5. Módulos de la aplicación

### Módulos existentes (ya diseñados en Figma Make):

#### M1 — Registro de Aplicaciones Foliares/Drench (formato SAIA/BPA principal)
El módulo más crítico. Digitaliza el Registro de Aplicaciones Foliares de Agroquímicos de Hortifrut. Existen DOS variantes del formato físico que deben unificarse:

**Variante A — Formato consolidado (Rancho El Solar, Carlos Alvarez N.):**
- Muchas filas por hoja, una aplicación por fila
- Sin campo de fecha de recomendación
- Sin fenología ni variedad

**Variante B — Formato por evento (Rancho Aranon, Alejandro Lucatero S.):**
- Una aplicación por página
- Incluye: fecha de recomendación vs fecha real, fenología, variedad, dosis/200L, cloración, condición meteorológica como checkboxes

**Campos del formulario unificado (4 pasos):**

Paso 1 — Parcela y cultivo:
- Productor (pre-filled, locked)
- Huerto / Rancho (dropdown)
- Código de huerto (auto-fill)
- Cultivo, Variedad, Sector, Superficie (has)
- Fenología (dropdown: Establecimiento / Floración / Cuajado de fruto / Engorde / Producción / Cosecha)
- Fecha de recomendación del asesor (date picker)
- Fecha real de aplicación (date picker) ← ALERTA si >7 días desde recomendación
- Hora inicio + Hora fin

Paso 2 — Producto(s):
- Nombre Comercial (searchable dropdown)
- Ingrediente Activo (auto-fill desde selección)
- RSCO/COFEPRIS (auto-fill)
- Justificación / Plaga objetivo (dropdown)
- Nivel de infestación (Bajo / Medio / Alto)
- Dosis por ha, Dosis por 200L agua, Total producto
- Días a cosecha (plazo), Re-entrada (hrs)
- Permite múltiples productos por aplicación

Paso 3 — Aplicación y agua:
- Tipo: Foliar / Drench (toggle grande)
- Equipo (dropdown: Bomba de motor / Bomba manual / Aspersora de mochila)
- Total agua usada (L)
- Cloración: Sí/No → si Sí: cantidad (L) + pH
- Condición meteorológica (chips selector único): Nublado / Muy soleado / Parcialmente soleado / Lluvioso / Lluvioso y nublado / Viento / Humedad
- EPP checklist (toggles): Traje protector / Guantes / Googles / Botas / Mascarillas

Paso 4 — Cierre:
- Caldos sobrantes: Sí/No → cantidad (L) + agua de lavado (L) + eliminado en área designada
- Nombre(s) del aplicador
- Asesor técnico (pre-filled)
- Responsable de inocuidad (pre-filled)
- Observaciones (textarea)
- CTA: "Guardar y generar PDF"

#### M2 — Inventario de Plaguicidas
- Entradas manuales al comprar
- Salidas automáticas al registrar aplicación
- Saldo en tiempo real por producto y rancho
- Historial de movimientos auditable

#### M3 — Historial y Reportes
- Filtros: productor, rancho, fecha, producto, tipo
- Timeline agrupado por fecha
- Exportación PDF/Excel

#### M4 — Panel Admin Hima
- Visibilidad de todos los productores en tiempo real
- Alertas: EPP incompleto, intervalo de seguridad vencido, aplicación sin recomendación
- Métricas de cumplimiento

#### M5 — Perfil y configuración
- Mis ranchos / cultivos
- Gestión de productos (catálogo)
- Asesores
- Notificaciones

---

### Módulos nuevos (pendientes de desarrollar) — Formularios SAIA/BPA adicionales:

Todos deben generar PDF replicando el formato oficial Hortifrut al guardar.

#### M6 — Botiquín de Primeros Auxilios (Pág. 101)
Clave: MXA-F-SC-SIG · Frecuencia: Semanal
Tabla con columna de fecha + materiales (Tiene/Llenar toggle por material):
materiales: Parachofc Writer, Guantes (talla S/M/L), Vendas y Tijeras, Gasas/Cinta, Desinfectante
+ Responsable + Firma verificación semanal
UI: tabla scrollable horizontal, columna Fecha congelada

#### M7 — Inspección de Vidrio y Plástico Duro (Pág. 118)
Clave: MXA-F-SC-SIG-029.14 · Frecuencia: Quincenal
Por evento: Fecha, Área, Material/Equipo, Rotegido (SI/NO), Estado (Bueno/Deteriorado/Reemplazo), Observaciones

#### M8 — Registro de Fertilización / Enmiendas al Suelo (Pág. 124)
Clave: MXA-F-SC-SIG-030.14
Por evento: Fecha, Sector, Nombre Comercial, Ingrediente Activo, Concentración, Método (Fertirriego/Drench/Band), Superficie ⚠️ (campo crítico — fondo #FAEEDA), Dosis Kg-L/Ha, Cantidad Total (auto-calculada), Operario, Verificación semanal

#### M9 — Inspección Perimetral de la Unidad de Producción (Pág. 133)
Frecuencia: Semanal
UI: checklist con columna izquierda sticky (labels) + columnas días 1-31 scrollables horizontalmente
Celda: tap cicla → S (#2B7AB5) → X (#C02A2A) → vacío
Día actual: fondo #E3F2FD
Secciones: Periferia del Huerto / Fuentes y Depósitos de Agua (Canal, Reservorio, Pozo) / Instalaciones y Almacenes (condicional si tiene almacén) / Intrusión Animal

#### M10 — Registro de Cosecha y Liberación (Pág. 170)
Clave: MXA-F-SC-SIG-038.14
Por evento: Fecha, Sector, Cantidad Bandejas, Lote Liberado (toggle), No. Comprobante, Código Trazabilidad (con scan), Marca/Embalaje, Destino Final, Fruta Proceso (Kg), Encargado Liberación, Verificación Semanal, Observaciones con hora inicio/fin cosecha ⚠️ (campo crítico)
Banner informativo al pie con referencia al Procedimiento MXA-P-SC-SIG-33-12

#### M11 — Inspección Pre-operacional de Cosecha y BPAs (Pág. 171)
Clave: MXA-F-SC-SIG-039.14 · Frecuencia: Diaria
UI: mismo patrón scrollable que M9 con columnas días 1-31
Respuesta: SI (√) / NO (X) / N/A
Columna extra: código de acción correctiva (input de texto por fila, se abre al tap)
Secciones: Área de Cosecha / Baños / Estación de Lavamanos / Higiene Personal / Material de Empaque / Área de Consumo de Alimentos / Salud del Trabajador / Área de Empaque y Carga / Contenedores Re-usables

#### M12 — Registro de Limpieza y Desinfección de Baños (Pág. 178)
Clave: MXA-F-SC-SIG-041.14 · Frecuencia: Diaria
Banner read-only (fondo --muted): Desinfectante: Hipoclorito de Sodio 5% 100-200ppm / Detergente: 4gr/L
Por evento: Fecha, Baño N°, Limpieza (toggle), Desinfección (toggle), Concentración (default 200), Sustancias (chips multi-select), Abasto Papel (toggle), Succión (toggle), Realizó (pre-filled), Firma semanal

---

## 6. Patrones de UI reutilizables

### Patrón A — Formulario por evento (M6, M7, M8, M10, M12)
- Nueva entrada via FAB (56px, #2B7AB5, bottom-right, 88px sobre bottom nav)
- Bottom sheet al 85% altura con campos del registro
- Entradas guardadas como cards en timeline agrupado por fecha
- Swipe izquierda en card: Editar (azul) / Eliminar (rojo)

### Patrón B — Checklist calendario scrollable (M9, M11)
- Columna izquierda sticky: fondo blanco, border-right rgba(0,0,0,0.1), min-width 180px
- Columnas días 1-31: 40px ancho c/u, scroll horizontal
- Celda: 40×40px tap target
- Día actual: fondo #E3F2FD
- SI: fondo #2B7AB5, ícono checkmark blanco
- NO: fondo #C02A2A, ícono X blanco
- N/A: fondo #ececf0, dash #717182
- Headers de sección: full-width, fondo #ececf0, texto bold, no scrollable

### Campos condicionales
- M9 secciones de almacén: toggle "¿Tiene almacén?" en header de sección
- Si OFF: filas con fondo --muted, texto --muted-foreground, no requeridas

### Campos críticos ⚠️
- Fondo: #FAEEDA, borde: #F5A623
- Usados en: Superficie (M8), Hora inicio/fin cosecha (M10)

---

## 7. Generación de PDF

Cada módulo debe generar un PDF que replique **exactamente** el formato físico original de Hortifrut:
- Encabezado Hortifrut con logo, título "FORMATOS MANUAL DEL SAIA Y BPA's", Fecha versión y número de versión
- Bloque productor: Productor, Cultivo, Código, Huerto, Variedad
- Clave del formato (ej: MXA-F-SC-SIG-030.14)
- Número de página original
- Estructura de tabla idéntica al formato físico
- Footer: firmas requeridas

---

## 8. Alertas automáticas del sistema

- **Recomendación vencida:** Si fecha de aplicación > 7 días desde fecha de recomendación → banner ámbar en formulario
- **EPP incompleto:** Si algún ítem de EPP está en OFF al llegar al Paso 4 → chip rojo en resumen
- **Intervalo de seguridad:** Si el producto tiene días a cosecha y la cosecha programada cae dentro del intervalo → alerta
- **Stock bajo:** En inventario, si saldo de un producto es bajo → chip ámbar en card

---

## 9. Soporte offline

- Guardar registros localmente cuando no hay conexión (IndexedDB o localStorage)
- Banner: fondo #FAEEDA, texto #854F0B: "Sin conexión — guardando localmente" con ícono sync
- Al recuperar conexión: sincronizar automáticamente con Supabase
- Indicador de sync en progreso

---

## 10. Plan de desarrollo — Sprints

| Sprint | Período | Entregables |
|--------|---------|-------------|
| Sprint 0 | Abril 2026 | Setup Supabase, auth, roles RLS, estructura base, diseño Figma aprobado |
| Sprint 1 | Mayo 2026 | Formulario 4 pasos (M1) funcional, validaciones, guardado en Supabase |
| Sprint 2 | Junio 2026 | Generación PDF SAIA/BPA, alerta recomendación vs aplicación, búsqueda de productos |
| Sprint 3 | Julio 2026 | Módulo inventario completo (M2), entradas/salidas automáticas |
| Sprint 4 | Ago-Sep 2026 | Panel admin Hima (M4), filtros, exportación Excel, notificaciones |
| Sprint 5 | Octubre 2026 | Módulos adicionales SAIA/BPA (M6-M12), pruebas con productores reales |
| Sprint 6 | Nov-Ene 2027 | Deploy producción DigitalOcean, capacitación, go-live |

---

## 11. Convenciones de código

- Componentes en PascalCase: `RegistroAplicacion.tsx`
- Hooks en camelCase con prefijo use: `useRegistro.ts`
- Tipos en PascalCase con sufijo Type o Interface: `RegistroType`
- Carpetas en kebab-case: `registro-aplicacion/`
- NO hardcodear colores — usar siempre las variables CSS del design system
- NO usar `npm` — este proyecto usa `pnpm`
- Comentarios en español (el equipo es hispanohablante)
- Siempre implementar RLS en Supabase para cualquier tabla nueva

---

## 12. Contactos y contexto humano

| Persona | Rol |
|---------|-----|
| Luviano Sánchez Saúl | Desarrollador — DuoMind Solutions |
| Medina Moreno Moisés | Desarrollador — DuoMind Solutions |
| Director Hima | Cliente / Product Owner |
| Luis Ignacio Rosales Guerrero | Asesor técnico agrícola — usuario clave |
| Carlos Alvarez Naranjo | Productor operario — Rancho El Solar |
| Alejandro Lucatero Sánchez | Productor operario — Rancho Aranon |

---

*Última actualización: Abril 2026 — DuoMind Solutions*
