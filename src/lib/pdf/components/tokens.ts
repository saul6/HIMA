// PDF Color & Size Tokens — fuente de verdad para plantilla base M.A.D.Y
// Usar estas constantes en todos los PDFs del sistema

export const PC = {  // PDF Colors
  navyBar1:   '#233546',
  navyBar2:   '#3EA18C',
  section:    '#3277AE',
  titleNavy:  '#1F2A37',
  textSub:    '#607286',
  fieldLabel: '#8A97A5',
  fieldValue: '#2A3742',
  folioBox:   '#EFF7F9',
  border:     '#E3E9EF',
  white:      '#FFFFFF',
  footerGray: '#9AA4AE',

  // ── Diseño nuevo (origen: M13) — lo usan src/lib/pdf/disenoNuevo y los PDF que lo adoptan ──
  negativo:      '#993C1D',  // --agro-danger-text: valores negativos, legible en impresión
  m13Navy:       '#173251',  // --auth-navy-dark (theme.css)
  m13Menta:      '#2AAD95',  // --secondary (theme.css)
  m13MentaSuave: '#E4F5F1',  // menta al ~12 % sobre blanco
  m13Texto:      '#2A3742',  // = fieldValue
  m13Fondo:      '#F4F7FA',  // gris azulado muy claro (franja de datos)
} as const
