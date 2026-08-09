# MADY Design Tokens
> Extraído del código real. Fuente única de verdad: `src/styles/theme.css` + `src/styles/fonts.css`.
> Última extracción: agosto 2026.

---

## 1. COLORES

### Paleta base (modo claro)

| Token CSS | Clase Tailwind | Valor HEX | Uso |
|-----------|---------------|-----------|-----|
| `--primary` | `bg-primary` / `text-primary` | `#173251` ⭐ | **Color de marca principal.** Botones primarios, FAB, toggles activos, nav activa |
| `--primary-foreground` | `text-primary-foreground` | `#FFFFFF` | Texto sobre fondo primario |
| `--secondary` | `bg-secondary` / `text-secondary` | `#2AAD95` | Acento secundario — verde esmeralda/menta; badges de éxito, acciones secundarias |
| `--secondary-foreground` | `text-secondary-foreground` | `#FFFFFF` | Texto sobre fondo secundario |
| `--background` | `bg-background` | `#FFFFFF` | Fondo general de la app |
| `--foreground` | `text-foreground` | `#090D15` | Texto principal (casi negro azulado) |
| `--card` | `bg-card` | `#FFFFFF` | Superficie de cards y paneles |
| `--card-foreground` | `text-card-foreground` | `#090D15` | Texto dentro de cards |
| `--popover` | `bg-popover` | `#FFFFFF` | Popovers y dropdowns |
| `--popover-foreground` | `text-popover-foreground` | `#090D15` | Texto en popovers |
| `--muted` | `bg-muted` | `#F0F7FC` | Fondos de sección header, áreas de bajo contraste |
| `--muted-foreground` | `text-muted-foreground` | `#607286` | Texto secundario, labels deshabilitados, placeholders |
| `--accent` | `bg-accent` | `#E5F2FA` | Fondo de acento (azul cielo claro); hover states, chips seleccionados |
| `--accent-foreground` | `text-accent-foreground` | `#173251` | Texto sobre fondo accent |
| `--border` | `border-border` | `rgba(9,13,21,0.10)` | Bordes de cards, inputs, divisores |
| `--ring` | `ring-ring` | `#81BEE5` | Focus ring de inputs y elementos interactivos |
| `--input` | — | `transparent` | Fondo de input (transparente; usa `--input-background`) |
| `--input-background` | `bg-input-background` | `#F3F6F9` | Fondo de campos de formulario |
| `--switch-background` | `bg-switch-background` | `#CBD2D9` | Toggle/switch en estado inactivo |
| `--destructive` | `bg-destructive` / `text-destructive` | `#C02A2A` | Acciones destructivas, alertas críticas, errores |
| `--destructive-foreground` | `text-destructive-foreground` | `#FFFFFF` | Texto sobre rojo destructivo |

### Colores de marca extendidos (agro-*)

| Token CSS | Clase Tailwind | Valor HEX | Uso |
|-----------|---------------|-----------|-----|
| `--agro-primary` | `text-agro-primary` | `#173251` | Alias del primario (azul oscuro) |
| `--agro-red` | `text-agro-red` / `bg-agro-red` | `#C02A2A` | Alertas críticas, errores visibles |
| `--agro-blue` | `text-agro-blue` / `bg-agro-blue` | `#81BEE5` | Azul cielo; decoración, gráficas, anillos |
| `--agro-amber` | `text-agro-amber` | `#2AAD95` | Verde menta (alias `--secondary`); confirmaciones, éxito |
| `--agro-background` | `bg-agro-background` | `#F8FAFC` | Fondo alternativo ligeramente off-white |
| `--agro-surface` | `bg-agro-surface` | `#FFFFFF` | Superficie de componente |
| `--agro-success-fill` | `bg-agro-success-fill` | `#E6F7F4` | Fondo de banners/chips de éxito |
| `--agro-success-text` | `text-agro-success-text` | `#1B7262` | Texto en banners de éxito |
| `--agro-warning-fill` | `bg-agro-warning-fill` | `#EBF5FB` | Fondo de banners de advertencia |
| `--agro-warning-text` | `text-agro-warning-text` | `#173251` | Texto en banners de advertencia |
| `--agro-danger-fill` | `bg-agro-danger-fill` | `#FAECE7` | Fondo de banners de peligro/error |
| `--agro-danger-text` | `text-agro-danger-text` | `#993C1D` | Texto en banners de peligro |

### Paleta de gráficas

| Token | HEX |
|-------|-----|
| `--chart-1` | `#173251` |
| `--chart-2` | `#2AAD95` |
| `--chart-3` | `#81BEE5` |
| `--chart-4` | `#090D15` |
| `--chart-5` | `#607286` |

### Modo oscuro (`.dark`)

| Token | Valor claro → Valor oscuro |
|-------|--------------------------|
| `--background` | `#FFFFFF` → `#090D15` |
| `--foreground` | `#090D15` → `#FFFFFF` |
| `--card` | `#FFFFFF` → `#121824` |
| `--primary` | `#173251` → `#81BEE5` |
| `--primary-foreground` | `#FFFFFF` → `#090D15` |
| `--muted` | `#F0F7FC` → `#1A2332` |
| `--muted-foreground` | `#607286` → `#8B9BB4` |
| `--accent` | `#E5F2FA` → `#173251` |
| `--destructive` | `#C02A2A` → `#E54D4D` |
| `--border` | `rgba(9,13,21,0.10)` → `rgba(255,255,255,0.15)` |

---

## 2. TIPOGRAFÍA

### Familia tipográfica

| Familia | Origen | Fallback |
|---------|--------|---------|
| **Inter** | Google Fonts — `fonts.googleapis.com/css2?family=Inter:wght@400;600` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` |

> Solo **Inter** se carga. El CLAUDE.md menciona "Nunito Sans" pero no hay `@font-face` ni import para ella en el código real.

### Escala de tamaños (base: `--font-size: 16px`)

Valores de Tailwind v4 por defecto; el proyecto no sobreescribe la escala.

| Elemento | Variable Tailwind | Tamaño | Peso | Line-height |
|----------|------------------|--------|------|-------------|
| `h1` | `--text-2xl` | 24 px / 1.5 rem | 600 (`--font-weight-medium`) | 1.5 |
| `h2` | `--text-xl` | 20 px / 1.25 rem | 600 | 1.5 |
| `h3` | `--text-lg` | 18 px / 1.125 rem | 600 | 1.5 |
| `h4` | `--text-base` | 16 px / 1 rem | 600 | 1.5 |
| `label` | `--text-base` | 16 px / 1 rem | 600 | 1.5 |
| `button` | `--text-base` | 16 px / 1 rem | 600 | 1.5 |
| `input` | `--text-base` | 16 px / 1 rem | 400 (`--font-weight-normal`) | 1.5 |
| Body / párrafo | `--text-base` | 16 px / 1 rem | 400 | 1.5 |
| Caption / auxiliar | `--text-sm` | 14 px / 0.875 rem | 400 | — |
| Micro / etiquetas | `--text-xs` | 12 px / 0.75 rem | 400 | — |

**Pesos usados:** `400` (normal) y `600` (medium). No se usa 500 en modo claro.

---

## 3. RADIOS Y ESPACIADOS

### Border-radius

| Token | Valor calculado | Uso |
|-------|----------------|-----|
| `--radius` (`--radius-lg`) | `0.625 rem` = **10 px** | Radio base — cards, botones, badges, bottom sheets |
| `--radius-sm` | `0.375 rem` = **6 px** | Elementos pequeños (chips, avatares) |
| `--radius-md` | `0.5 rem` = **8 px** | Inputs, selects |
| `--radius-xl` | `0.875 rem` = **14 px** | Popovers, modales |
| Bottom sheet (top) | `0.625 rem` | Solo las esquinas superiores |
| FAB | `50%` (círculo) | 56 px de diámetro |

### Espaciado

El proyecto usa la escala de espaciado por defecto de Tailwind v4 (`4px` por unidad). No hay escala tokenizada propia. Valores relevantes del diseño:

| Concepto | Valor |
|----------|-------|
| FAB size | 56 px |
| Bottom nav height | ~64 px (5 tabs) |
| Bottom sheet height | 85 % del viewport |
| Ancho máximo (mobile-first) | 390 px (`max-w` en `Layout.tsx`) |

---

## 4. SOMBRAS Y EFECTOS

**Regla de diseño:** **Sin sombras. Sin gradientes.** Confirmado en `CLAUDE.md` § 3 y en el código (ningún `shadow-*` ni `bg-gradient-*` en componentes de diseño propios).

La elevación visual se logra únicamente con:
- Bordes: `border border-border` (`rgba(9,13,21,0.10)`)
- Diferencia de fondo: `bg-card` (#FFFFFF) sobre `bg-background` (#FFFFFF) o `bg-muted` (#F0F7FC)
- Color de texto: jerarquía `--foreground` → `--muted-foreground`

---

## 5. LOGO

| Elemento | Valor |
|----------|-------|
| Asset PNG | `public/images/MADY.png` (único archivo, usado para ambos temas) |
| Componente React | `src/app/components/MadyLogo.tsx` — props: `theme: 'light' | 'dark'`, `className`, `style` |
| Renderizado | `<img>` con `objectFit: contain`; ambas variantes apuntan al mismo archivo actualmente |
| Construcción del nombre | M y A en `#173251`; D e Y en blanco sobre fondo oscuro / `#173251` sobre claro |

---

## 6. BREAKPOINTS

Tailwind v4 por defecto (no hay `theme.extend.screens` ni config personalizado):

| Breakpoint | Valor |
|-----------|-------|
| `sm` | 640 px |
| `md` | 768 px |
| `lg` | 1024 px |
| `xl` | 1280 px |
| `2xl` | 1536 px |

**Estrategia real:** mobile-first. El layout canónico es **390 × 844 px** (iPhone 14 Pro). El `max-width` del Layout es 390 px; pantallas más anchas ven la app centrada. No hay diseño de escritorio propio.

---

## RESUMEN PARA STITCH

```
Nombre del producto: M.A.D.Y
Color primario (marca): #173251 (azul marino oscuro)
Color secundario / acento: #2AAD95 (verde esmeralda/menta)
Azul claro / ring: #81BEE5
Fondo general: #FFFFFF
Fondo alternativo (off-white): #F8FAFC
Superficie de sección / header: #F0F7FC
Texto principal: #090D15
Texto secundario / muted: #607286
Error / destructivo: #C02A2A
Fuente: Inter (Google Fonts), pesos 400 y 600 únicamente
Radio base: 0.625 rem (10 px)
Sin sombras. Sin gradientes. Mobile-first (390 px).
```
