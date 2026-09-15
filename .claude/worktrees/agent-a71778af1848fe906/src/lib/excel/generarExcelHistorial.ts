import ExcelJS from 'exceljs'
import { formatFenologia } from '@/lib/fenologia'
import type { AplicacionRica } from '@/types/database.types'

// ── Constantes de estilo ─────────────────────────────────────────────────────

const PRIMARY_ARGB   = 'FF2B7AB5'
const WHITE_ARGB     = 'FFFFFFFF'
const HEADER_BG      = 'FFE3F2FD'
const BORDER_COLOR   = 'FFCCCCCC'
const ROW_ALT_ARGB   = 'FFF5F9FE'
const DARK_ARGB      = 'FF1A1A1A'

const THIN_BORDER: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: BORDER_COLOR } }
const ALL_BORDERS: Partial<ExcelJS.Borders> = {
  top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function v(x: string | number | boolean | null | undefined): string {
  if (x == null || x === '') return '—'
  if (typeof x === 'boolean') return x ? 'Sí' : 'No'
  return String(x)
}

function eppCompleto(ap: AplicacionRica['aplicacion_productos'][number]['catalogo_productos'] extends never ? never : AplicacionRica): boolean {
  const a = (ap as AplicacionRica).aplicacion
  return a.epp_traje && a.epp_guantes && a.epp_googles && a.epp_botas && a.epp_mascarillas
}

function fillCell(cell: ExcelJS.Cell, bgArgb: string, textArgb = DARK_ARGB, bold = false) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } }
  cell.font = { color: { argb: textArgb }, bold }
  cell.border = ALL_BORDERS
}

function labelCell(cell: ExcelJS.Cell, text: string) {
  cell.value = text
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
  cell.font = { bold: true, size: 9 }
  cell.border = ALL_BORDERS
  cell.alignment = { wrapText: true, vertical: 'middle' }
}

function valueCell(cell: ExcelJS.Cell, text: string | number) {
  cell.value = text
  cell.border = ALL_BORDERS
  cell.alignment = { wrapText: true, vertical: 'middle' }
}

// ── Hoja 1 — Historial ───────────────────────────────────────────────────────

const HISTORIAL_COLS = [
  { header: 'Fecha aplicación',   key: 'fecha',       width: 16 },
  { header: 'Productor',          key: 'productor',   width: 26 },
  { header: 'Rancho',             key: 'rancho',      width: 22 },
  { header: 'Cultivo',            key: 'cultivo',     width: 14 },
  { header: 'Variedad',           key: 'variedad',    width: 14 },
  { header: 'Sector',             key: 'sector',      width: 10 },
  { header: 'Superficie (ha)',    key: 'superficie',  width: 14 },
  { header: 'Fenología',          key: 'fenologia',   width: 18 },
  { header: 'Tipo',               key: 'tipo',        width: 10 },
  { header: 'Productos',          key: 'productos',   width: 36 },
  { header: 'Total agua (L)',     key: 'agua',        width: 14 },
  { header: 'EPP completo',       key: 'epp',         width: 12 },
  { header: 'Asesor',             key: 'asesor',      width: 24 },
  { header: 'Estado',             key: 'estado',      width: 12 },
] as const

function buildHistorialSheet(ws: ExcelJS.Worksheet, apps: AplicacionRica[]) {
  ws.columns = HISTORIAL_COLS.map(c => ({ header: c.header, key: c.key, width: c.width }))

  // Estilo de encabezado
  const headerRow = ws.getRow(1)
  headerRow.height = 20
  headerRow.eachCell(cell => {
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_ARGB } }
    cell.font   = { color: { argb: WHITE_ARGB }, bold: true, size: 9 }
    cell.border = ALL_BORDERS
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })

  // Filtros automáticos
  ws.autoFilter = { from: 'A1', to: `N1` }

  // Filas de datos
  apps.forEach((app, idx) => {
    const a = app.aplicacion ?? app  // compatible si viene el objeto completo
    const ap = app as AplicacionRica

    const nombresProductos = ap.aplicacion_productos
      .map(p => p.catalogo_productos.nombre_comercial)
      .join(', ')

    const epp = ap.aplicacion.epp_traje
      && ap.aplicacion.epp_guantes
      && ap.aplicacion.epp_googles
      && ap.aplicacion.epp_botas
      && ap.aplicacion.epp_mascarillas

    const row = ws.addRow({
      fecha:      ap.aplicacion.fecha_aplicacion,
      productor:  ap.productores?.profiles?.nombre_completo ?? '—',
      rancho:     ap.ranchos?.nombre ?? '—',
      cultivo:    ap.ranchos?.cultivo ?? '—',
      variedad:   ap.aplicacion.variedad ?? '—',
      sector:     ap.aplicacion.sector ?? '—',
      superficie: ap.aplicacion.superficie_ha ?? '—',
      fenologia:  formatFenologia(ap.aplicacion.fenologia ?? undefined),
      tipo:       ap.aplicacion.tipo_aplicacion,
      productos:  nombresProductos || '—',
      agua:       ap.aplicacion.total_agua_l ?? '—',
      epp:        epp ? 'Sí' : 'No',
      asesor:     ap.asesor?.nombre_completo ?? '—',
      estado:     ap.aplicacion.status,
    })

    row.height = 16
    const isAlt = idx % 2 === 1
    row.eachCell(cell => {
      if (isAlt) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROW_ALT_ARGB } }
      }
      cell.border = ALL_BORDERS
      cell.alignment = { vertical: 'middle', wrapText: false }
    })
  })
}

// ── Hoja 2 — Formato oficial ─────────────────────────────────────────────────

function sectionHeader(ws: ExcelJS.Worksheet, row: number, title: string, colCount = 8) {
  ws.mergeCells(row, 1, row, colCount)
  const cell = ws.getCell(row, 1)
  cell.value = title
  cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_ARGB } }
  cell.font  = { color: { argb: WHITE_ARGB }, bold: true, size: 9 }
  cell.border = ALL_BORDERS
  cell.alignment = { vertical: 'middle', indent: 1 }
  ws.getRow(row).height = 16
  return row + 1
}

function infoRow2(
  ws: ExcelJS.Worksheet,
  row: number,
  leftLabel: string,
  leftVal: string,
  rightLabel: string,
  rightVal: string,
) {
  ws.getRow(row).height = 14
  const cells = [
    ws.getCell(row, 1), ws.getCell(row, 2),
    ws.getCell(row, 3), ws.getCell(row, 4),
    ws.getCell(row, 5), ws.getCell(row, 6),
    ws.getCell(row, 7), ws.getCell(row, 8),
  ]

  // Merge A:B = left label, C:D = left val, E:F = right label, G:H = right val
  ws.mergeCells(row, 1, row, 2)
  ws.mergeCells(row, 3, row, 4)
  ws.mergeCells(row, 5, row, 6)
  ws.mergeCells(row, 7, row, 8)

  labelCell(cells[0], leftLabel)
  valueCell(cells[2], leftVal)
  labelCell(cells[4], rightLabel)
  valueCell(cells[6], rightVal)

  return row + 1
}

function writeAplicacionBlock(ws: ExcelJS.Worksheet, startRow: number, app: AplicacionRica): number {
  const ap = app.aplicacion ?? app as unknown as AplicacionRica['aplicacion']
  const a = app as AplicacionRica
  let r = startRow

  const folio = ap.id.slice(0, 8).toUpperCase()

  // ── Título del bloque ──
  ws.mergeCells(r, 1, r, 8)
  const titleCell = ws.getCell(r, 1)
  titleCell.value = `REGISTRO DE APLICACIONES FOLIARES — Folio: ${folio} | Fecha: ${ap.fecha_aplicacion}`
  titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } }
  titleCell.font  = { color: { argb: WHITE_ARGB }, bold: true, size: 10 }
  titleCell.border = ALL_BORDERS
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(r).height = 18
  r++

  // ── Sección 1 — Datos del productor ──
  r = sectionHeader(ws, r, '1. DATOS DEL PRODUCTOR Y PARCELA')
  r = infoRow2(ws, r, 'Productor', a.productores?.profiles?.nombre_completo ?? '—', 'Rancho / Huerto', a.ranchos?.nombre ?? '—')
  r = infoRow2(ws, r, 'Cultivo', a.ranchos?.cultivo ?? '—', 'Variedad', v(ap.variedad))
  r = infoRow2(ws, r, 'Código de huerto', a.ranchos?.codigo ?? '—', 'Sector', v(ap.sector))
  r = infoRow2(ws, r, 'Superficie (ha)', v(ap.superficie_ha), 'Etapa fenológica', formatFenologia(ap.fenologia ?? undefined))

  // ── Sección 2 — Fechas y condiciones ──
  r = sectionHeader(ws, r, '2. FECHAS, HORARIOS Y CONDICIONES DE APLICACIÓN')
  r = infoRow2(ws, r, 'Fecha recomendación asesor', v(ap.fecha_recomendacion), 'Fecha real de aplicación', v(ap.fecha_aplicacion))
  r = infoRow2(ws, r, 'Hora inicio', v(ap.hora_inicio), 'Hora fin', v(ap.hora_fin))
  r = infoRow2(ws, r, 'Tipo de aplicación', ap.tipo_aplicacion, 'Total agua usada (L)', v(ap.total_agua_l))
  r = infoRow2(ws, r, 'Equipo', v(ap.equipo), 'Condición meteorológica', v(ap.condicion_meteorologica))
  r = infoRow2(ws, r,
    'Cloración',
    ap.cloracion ? `Sí — ${v(ap.cloro_cantidad_l)} L · pH ${v(ap.cloro_ph)}` : 'No',
    '', ''
  )

  // ── Sección 3 — Productos aplicados ──
  r = sectionHeader(ws, r, '3. PRODUCTOS APLICADOS')

  // Encabezado de tabla de productos (columnas A–H expandidas)
  const prodHeaders = ['Justificación / Plaga', 'Nivel infestación', 'Nombre Comercial', 'Ingrediente Activo', 'Dosis/ha', 'Dosis/200L', 'Total producto', 'Días cosecha']
  ws.getRow(r).height = 14
  prodHeaders.forEach((h, ci) => {
    const cell = ws.getCell(r, ci + 1)
    cell.value = h
    fillCell(cell, PRIMARY_ARGB, WHITE_ARGB, true)
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.font = { color: { argb: WHITE_ARGB }, bold: true, size: 8 }
  })
  r++

  if (a.aplicacion_productos.length === 0) {
    ws.mergeCells(r, 1, r, 8)
    const cell = ws.getCell(r, 1)
    cell.value = 'Sin productos registrados'
    cell.border = ALL_BORDERS
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    r++
  } else {
    a.aplicacion_productos.forEach((p, pi) => {
      ws.getRow(r).height = 14
      const isAlt = pi % 2 === 1
      const bgArgb = isAlt ? ROW_ALT_ARGB : WHITE_ARGB
      const vals = [
        p.plaga_objetivo ?? '—',
        p.nivel_infestacion ?? '—',
        p.catalogo_productos.nombre_comercial,
        p.catalogo_productos.ingrediente_activo,
        p.dosis_ha ?? '—',
        p.dosis_200l ?? '—',
        p.total_producto ?? '—',
        p.dias_cosecha ?? '—',
      ]
      vals.forEach((val, ci) => {
        const cell = ws.getCell(r, ci + 1)
        cell.value = String(val)
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } }
        cell.border = ALL_BORDERS
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.font = { size: 8 }
      })
      r++
    })
  }

  // ── Sección 4 — EPP ──
  r = sectionHeader(ws, r, '4. EQUIPO DE PROTECCIÓN PERSONAL (EPP)')
  const eppItems = [
    ['Traje protector', ap.epp_traje],
    ['Guantes', ap.epp_guantes],
    ['Googles', ap.epp_googles],
    ['Botas', ap.epp_botas],
    ['Mascarillas', ap.epp_mascarillas],
  ] as [string, boolean][]

  ws.getRow(r).height = 14
  eppItems.forEach(([label, checked], ci) => {
    if (ci < 8) {
      const lCell = ws.getCell(r, ci * 1 + 1)  // simplificado: cada EPP en su columna
      // Como tenemos 5 EPPs y 8 columnas, los metemos de a 2 celdas cada uno (merge)
    }
  })

  // Filas EPP: 2 columnas merge por ítem, todos en una fila
  eppItems.forEach(([label, checked], ci) => {
    const colStart = ci * 1 + 1  // cols 1-5 (sin merge por simplicidad)
    if (colStart <= 8) {
      ws.mergeCells(r, colStart, r, colStart)
      const cell = ws.getCell(r, colStart)
      cell.value = `${checked ? '✓' : '✗'} ${label}`
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: checked ? 'FFE3F2FD' : 'FFFAFAFA' } }
      cell.font  = { color: { argb: checked ? 'FF0D5A8F' : 'FF888888' }, bold: checked, size: 9 }
      cell.border = ALL_BORDERS
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    }
  })
  // Celda 6–8 vacía
  for (let ci = 6; ci <= 8; ci++) {
    const cell = ws.getCell(r, ci)
    cell.border = ALL_BORDERS
  }
  r++

  // ── Sección 5 — Caldos sobrantes ──
  r = sectionHeader(ws, r, '5. CALDOS SOBRANTES')
  r = infoRow2(ws, r,
    '¿Hubo caldos sobrantes?', ap.caldos_sobrantes ? 'Sí' : 'No',
    ap.caldos_sobrantes ? 'Cantidad (L)' : '',
    ap.caldos_sobrantes ? v(ap.caldos_cantidad_l) : ''
  )
  if (ap.caldos_sobrantes) {
    r = infoRow2(ws, r,
      'Agua de lavado (L)', v(ap.caldos_agua_lavado_l),
      '¿Eliminado en área designada?',
      ap.caldos_area_designada === true ? 'Sí' : ap.caldos_area_designada === false ? 'No' : '—'
    )
  }

  // ── Sección 6 — Observaciones (condicional) ──
  if (ap.observaciones) {
    r = sectionHeader(ws, r, '6. OBSERVACIONES')
    ws.mergeCells(r, 1, r, 8)
    const obsCell = ws.getCell(r, 1)
    obsCell.value = ap.observaciones
    obsCell.border = ALL_BORDERS
    obsCell.alignment = { wrapText: true, vertical: 'top' }
    ws.getRow(r).height = 32
    r++
  }

  // ── Sección 7 — Firmas ──
  const firmasNum = ap.observaciones ? '7' : '6'
  r = sectionHeader(ws, r, `${firmasNum}. FIRMAS Y RESPONSABLES`)

  // Encabezados de firmas (A:B, C:E, F:H — fusionados en grupos de ~3)
  const firmaHeaders = ['Nombre(s) del aplicador', 'Asesor técnico', 'Responsable de inocuidad']
  const firmaVals    = [
    v(ap.aplicadores),
    a.asesor?.nombre_completo ?? '—',
    a.responsable?.nombre_completo ?? '—',
  ]

  ws.getRow(r).height = 14
  ;[[1,2],[3,5],[6,8]].forEach(([colS, colE], fi) => {
    ws.mergeCells(r, colS, r, colE)
    labelCell(ws.getCell(r, colS), firmaHeaders[fi])
  })
  r++

  ws.getRow(r).height = 14
  ;[[1,2],[3,5],[6,8]].forEach(([colS, colE], fi) => {
    ws.mergeCells(r, colS, r, colE)
    valueCell(ws.getCell(r, colS), firmaVals[fi])
  })
  r++

  // Línea de firma (fila con borde superior = "________________")
  ws.getRow(r).height = 20
  ;[[1,2],[3,5],[6,8]].forEach(([colS, colE]) => {
    ws.mergeCells(r, colS, r, colE)
    const cell = ws.getCell(r, colS)
    cell.border = { top: { style: 'thin', color: { argb: DARK_ARGB } }, ...ALL_BORDERS }
    cell.alignment = { vertical: 'bottom', horizontal: 'center' }
    cell.value = 'Firma'
    cell.font  = { italic: true, color: { argb: 'FF888888' }, size: 8 }
  })
  r++

  // Separador entre aplicaciones
  ws.getRow(r).height = 8
  r++

  return r
}

// ── Función principal ─────────────────────────────────────────────────────────

export async function generarExcelHistorial(
  apps: AplicacionRica[],
  nombreArchivo?: string,
): Promise<void> {
  // Buffer polyfill — requerido por exceljs en el browser
  if (typeof (globalThis as unknown as Record<string, unknown>).Buffer === 'undefined') {
    const { Buffer } = await import('buffer')
    ;(globalThis as unknown as Record<string, unknown>).Buffer = Buffer
  }

  const wb = new ExcelJS.Workbook()
  wb.creator  = 'M.A.D.Y'
  wb.created  = new Date()

  // ── Hoja 1 ──
  const ws1 = wb.addWorksheet('Historial')
  buildHistorialSheet(ws1, apps)

  // ── Hoja 2 ──
  const ws2 = wb.addWorksheet('Formato oficial')

  // Anchos fijos para el formato oficial (8 columnas)
  ws2.columns = [
    { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 },
    { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 },
  ]

  let currentRow = 1
  for (const app of apps) {
    currentRow = writeAplicacionBlock(ws2, currentRow, app)
  }

  // ── Descarga ──
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href  = url
  link.download = nombreArchivo ?? `M.A.D.Y_Historial_${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
