Add the following 8 new form modules to the existing AgroCampo mobile-first web application for Hima Inocuidad Alimentaria.

━━━ DESIGN SYSTEM — USE EXISTING TOKENS EXACTLY ━━━
All new screens must match the existing AgroCampo design system precisely. Use these CSS variable values:

Primary (--primary / --agro-green): #2B7AB5
Blue secondary (--agro-blue): #1E88C7
Destructive / alert (--agro-red): #C02A2A
Warning amber (--agro-amber): #F5A623
Background (--background / --agro-background): #F8F9FA
Surface / card (--card / --agro-surface): #FFFFFF
Success fill (--agro-success-fill): #E3F2FD
Success text (--agro-success-text): #0D5A8F
Warning fill (--agro-warning-fill): #FAEEDA
Warning text (--agro-warning-text): #854F0B
Danger fill (--agro-danger-fill): #FAECE7
Danger text (--agro-danger-text): #993C1D
Muted text (--muted-foreground): #717182
Border (--border): rgba(0,0,0,0.1)
Input background (--input-background): #f3f3f5
Border radius (--radius): 0.625rem

Typography: font-weight-medium = 600, font-weight-normal = 400
Do NOT use green as primary — the app uses blue #2B7AB5 as its primary brand color.

━━━ NEW MODULE 1 — Botiquín de Primeros Auxilios (Pág. 101) ━━━
Clave: MXA-F-SC-SIG · Frequency: Weekly

Fields at top: Productor, Cultivo, Código, Huerto, Variedad (pre-filled, locked, muted style)

Main table — each row = one inspection date:
  · Fecha (date picker)
  · For each material: two sub-columns Tiene + Llenar (yes/no toggle pills):
      - Parachofc Writer · Guantes de (S/M/L selector)
      - Vendas y Tijeras · Gasas/Cinta · Desinfectante
  · Responsable (pre-filled from user profile)
  · Firma de verificación semanal (initials input field)

UI: Horizontally scrollable table, frozen Fecha column.
Tiene/Llenar = green pill (#E3F2FD / #0D5A8F) for SI, red pill (#FAECE7 / #993C1D) for NO.
Footer: digital signature field "Firma del Responsable de Inocuidad".

━━━ NEW MODULE 2 — Inspección de Vidrio y Plástico Duro (Pág. 118) ━━━
Clave: MXA-F-SC-SIG-029.14 · Frequency: Biweekly

Info banner: "Marcar √ o X según sea el caso" — style with --muted background (#ececf0), --muted-foreground text.

Main table — each row = one inspected item:
  · Fecha · Área (dropdown) · Material o Equipo (text + suggestions)
  · Rotegido SI/NO (toggle, primary color #2B7AB5 when active)
  · Estado (pill selector: Bueno = #E3F2FD/#0D5A8F · Deteriorado = #FAEEDA/#854F0B · Reemplazo = #FAECE7/#993C1D)
  · Observaciones (expandable textarea, --input-background: #f3f3f5)

New entry via bottom sheet (85% height). Entries shown as timeline cards grouped by date.
Footer: Realizó (pre-filled) + signature field.

━━━ NEW MODULE 3 — Registro de Fertilización / Enmiendas al Suelo (Pág. 124) ━━━
Clave: MXA-F-SC-SIG-030.14

Main table — each row = one fertilization event:
  · Fecha · Sector · Nombre Comercial (searchable dropdown)
  · Ingrediente Activo (auto-filled, muted style --muted-foreground #717182)
  · Concentración · Método de Aplicación (Fertirriego / Drench / Band)
  · Superficie (highlighted field: background #FAEEDA, border #F5A623 — critical required field)
  · Dosis Kg-L/Ha · Cantidad Total Aplicada (auto-calculated, --agro-success-fill background)
  · Nombre del Operario (pre-filled) · Verificación Semanal (toggle)

Footer: Asesor Técnico name field + Responsable de Inocuidad signature.

━━━ NEW MODULE 4 — Inspección Perimetral de la Unidad de Producción (Pág. 133) ━━━
Frequency: Weekly

Design pattern: Vertical checklist with sticky left column (min-width 180px, white bg, border-right rgba(0,0,0,0.1)) and horizontally scrollable day columns 1–31.
Current day column: highlighted with --agro-success-fill (#E3F2FD) background.
Each cell: 40×40px tap target, cycles: empty → S (primary #2B7AB5, checkmark icon) → X (--agro-red #C02A2A, x icon) → empty.
Section headers: full-width divider, background --muted (#ececf0), bold text, not scrollable.

Sections:
  PERIFERIA DEL HUERTO: Carreola animal · Envases de agroquímicos · Basura/plásticos/pvc/vidrio · Barreras físicas y naturales · Presencia de animales

  FUENTES Y DEPÓSITOS DE AGUA — CANAL (Zanja): Presencia de basura · Presencia de animales muertos · Envases de agroquímicos · Limpieza de maleza y derasalvo · Materia fecal

  RESERVORIO (Pilar, alas, pilote): Presencia de basura · Animales muertos · Envases agroquímicos · Limpieza maleza · Cerca perimetral · Materia fecal

  POZO: Presencia de basura · Campamento cerrado · Flujo de agua · Flujo de aceite · Cerca perimetral · Limpieza de maleza · Materia fecal

  INSTALACIONES / ALMACENES — MATERIAL DE EMPAQUE: Orden y limpieza · Trampa · Material sobre tarima · Cajas corredas · Sanitizco completa
  [Conditional toggle "¿Tiene almacén?" — if OFF, rows gray out with --muted style]

  ALMACÉN DE AGROQUÍMICOS: Orden y limpieza · Productos clarificada · Equipo antidiarrea · Productos correctamente · Sanitizco completa
  [Same conditional toggle as above]

  INTRUSIÓN ANIMAL: Presencia de madrigueras · Presencia de animales · Evidencia de nidos · Otras · Observaciones

Footer: Realizó + Responsable de Inocuidad (pre-filled from profile).

━━━ NEW MODULE 5 — Registro de Cosecha y Liberación (Pág. 170) ━━━
Clave: MXA-F-SC-SIG-038.14

Main table — each row = one harvest event:
  · Fecha · Sector · Cantidad Bandejas
  · Lote Liberado SI/NO (toggle — primary #2B7AB5 when active)
  · No. de Comprobante o Vale Interno · Código de Trazabilidad (with barcode scan icon in --primary color)
  · Marca y Embalaje (dropdown) · Destino Final (dropdown)
  · Fruta de Proceso Kg · Encargado de la Liberación (pre-filled)
  · Verificación Semanal (toggle)
  · Observaciones — Hora inicio y final de cosecha (two time pickers side by side, field background #FAEEDA border #F5A623 — critical)

Alert banner at bottom: background --agro-warning-fill (#FAEEDA), text --agro-warning-text (#854F0B), icon warning triangle.
Text: "Para la liberación del producto se tomarán en cuenta los criterios del Procedimiento MXA-P-SC-SIG-33-12."
Footer: signature field.

━━━ NEW MODULE 6+7 — Inspección Pre-operacional de Cosecha y Seguimiento BPAs (Pág. 171) ━━━
Clave: MXA-F-SC-SIG-039.14 · Frequency: Daily

Same scrollable calendar pattern as Module 4.
Response options per cell: SI (√ — #2B7AB5) / NO (X — #C02A2A) / N/A (dash — #717182)
Extra column: "Acción correctiva y preventiva" — small text input per row, shown on tap.

Sections:
  ÁREA DE COSECHA Y TERRENOS ADYACENTES: El lote cubre el intervalo de cosecha (IS) · Evidencia de intrusión animal · Evidencia de contaminación fecal · Perímetro libre de basura/vidrio/plástico · Peligro en terrenos adyacentes

  BAÑOS: Funcionando adecuadamente · Limpios · Papel higiénico suspendido · Deposito con solución · Mingitorios libres · Señalamientos

  ESTACIÓN DE LAVAMANOS: Funcionando adecuadamente · Agua con cloro · Jabón líquido sin aroma · Papel secante · Bote de basura con bolsa y tapa · Señalamientos · Gel antibacterial · Lavado y desinfección tinacos (cloro 200 ppm)

  HIGIENE PERSONAL: Lavado de manos observado · Libre de joyería · Libre de maquillaje · Uñas cortas y limpias · Cabello protegido · Libre de heridas · Libre de enfermedades infectocontagiosas · Sin alimentos en área · Ropa limpia y calzado cerrado · Sin objetos personales

  MANEJO DE MATERIAL DE EMPAQUE: Libre de contacto con el suelo · Material limpio y libre de objetos

  ÁREA DE CONSUMO DE ALIMENTOS: Limpio · Bote de basura con tapa · Agua potable · Vasos individuales · Señalamientos

  SALUD DEL TRABAJADOR: Con síntomas de enfermedades · Botiquín de primeros auxilios

  ÁREA DE EMPAQUE Y CARGA: Área limpia y ordenada · Lavado y desinfección de mesas · Mesas sin desprendimiento de pintura ni óxido · Fruta en tarimas · Vehículo limpio · Inspección de trampas para plagas · Pegamento sucio o en mal estado

  CONTENEDORES RE-USABLES (canastas, bolsas, morrales, cubetas): Lavado y desinfección · Almacenados correctamente · Buen estado

Footer: Iniciales + Nombre completo de quien inspeccionó + Firma del Responsable de Inocuidad.

━━━ NEW MODULE 8 — Registro de Limpieza y Desinfección de Baños (Pág. 178) ━━━
Clave: MXA-F-SC-SIG-041.14 · Frequency: Daily

Read-only info banner (--muted background #ececf0, --muted-foreground #717182):
  "Desinfectante: Hipoclorito de Sodio 5%, Concentración 100-200 ppm"
  "Detergente: Detergente en polvo, 4 gr por litro de solución"

Main table — each row = one cleaning event:
  · Fecha · Baño N° (number)
  · Limpieza — Lavar y tallar (toggle)
  · Desinfección — Asperjar 3ml cloro (toggle)
  · Concentración (number, default 200, --input-background #f3f3f5)
  · Sustancias Utilizadas (multi-select chips: Agua / Jabón)
  · Abasto de Papel Higiénico (toggle) · Succión (toggle)
  · Realizó (pre-filled from profile)
  · Firma verificación semanal (initials field)

All active toggles use --primary #2B7AB5. Inactive = --switch-background #cbced4.
Footer: signature field.

━━━ SHARED RULES FOR ALL 8 NEW MODULES ━━━

Navigation: All new modules grouped under a new dashboard section "Inocuidad y BPAs" with icon + module name + last entry date + status chip.
Status chips: Al día (#E3F2FD / #0D5A8F) · Pendiente (#FAEEDA / #854F0B) · Vencido (#FAECE7 / #993C1D)

New entry FAB: 56px circle, background --primary #2B7AB5, white "+" icon, bottom-right, 88px above bottom nav.

Bottom sheet pattern (modules 1, 2, 3, 5, 8):
  · Opens at 85% screen height with handle bar
  · White background (#FFFFFF), border-radius 0.625rem top corners
  · Fields use --input-background (#f3f3f5) with 0.625rem radius
  · Primary CTA button: full-width, background #2B7AB5, white text, 56px height

Scrollable calendar pattern (modules 4, 6+7):
  · Sticky left column: white bg, 1px right border rgba(0,0,0,0.1), min-width 180px
  · Day columns: 40px wide each, horizontally scrollable
  · Current day: background #E3F2FD (#agro-success-fill)
  · SI cell: #2B7AB5 background, white checkmark
  · NO cell: #C02A2A background, white X
  · N/A cell: #ececf0 background, #717182 dash
  · Section dividers: full-width, #ececf0 background, 600 font-weight label

PDF export: Each module generates a PDF replicating the exact physical SAIA/BPA format — Hortifrut header, Clave, page number, producer info block, original table structure, footer signatures.

Offline: Queue entries locally when offline. Show amber banner (#FAEEDA / #854F0B): "Sin conexión — guardando localmente" with sync icon.

Conditional fields (Module 4): "¿Tiene almacén?" toggle at section header. When OFF: rows use --muted (#ececf0) background and --muted-foreground (#717182) text, not required.