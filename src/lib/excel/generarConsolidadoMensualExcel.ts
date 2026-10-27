import ExcelJS from 'exceljs'
import { etiquetaMetodo } from '@/lib/nomina/formato'
import type { ConsolidadoGuardado } from '@/types/nomina.types'

// Excel para contabilidad: mismos datos que el PDF (es la misma revisión guardada).
// Sin fórmulas ni vínculos; importes numéricos y fechas como fecha.

const TIPO_MOV: Record<string, string> = { pago: 'Pago', anticipo: 'Anticipo', reversion: 'Reversión' }

/** Un texto que empieza con = + - @ se tomaría como fórmula: se antepone ' para neutralizarlo. */
export function textoSeguro(x: string | null | undefined): string {
  const t = x ?? ''
  return /^[=+\-@]/.test(t) ? `'${t}` : t
}

/** 'AAAA-MM-DD' (o timestamp) → Date de calendario en UTC, para que Excel no la corra de día. */
function aFecha(valor: string | null | undefined): Date | null {
  if (!valor) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor)
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null
}

const FORMATO_FECHA = 'dd/mm/yyyy'
const FORMATO_HORA = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short',
})
const textoHora = (v: string | null | undefined) => {
  if (!v) return ''
  const t = new Date(v)
  return Number.isNaN(t.getTime()) ? v : FORMATO_HORA.format(t)
}

interface Col { header: string; key: string; width: number; tipo?: 'moneda' | 'fecha' }

function hoja(wb: ExcelJS.Workbook, nombre: string, cols: Col[], filas: Record<string, unknown>[], moneda: string) {
  const ws = wb.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = cols.map(c => ({ header: c.header, key: c.key, width: c.width }))
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).alignment = { vertical: 'middle', wrapText: true }
  filas.forEach(f => ws.addRow(f))
  cols.forEach((c, i) => {
    if (c.tipo === 'moneda') ws.getColumn(i + 1).numFmt = `"${moneda === 'MXN' ? '$' : moneda + ' '}"#,##0.00;[Red]-"${moneda === 'MXN' ? '$' : moneda + ' '}"#,##0.00`
    if (c.tipo === 'fecha') ws.getColumn(i + 1).numFmt = FORMATO_FECHA
  })
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } }
  return ws
}

export function nombreArchivoConsolidadoExcel(c: Pick<ConsolidadoGuardado, 'datos' | 'revision'>) {
  return `consolidado-mensual-${c.datos.mes}-R${c.revision}.xlsx`
}

export async function generarConsolidadoMensualExcel(c: ConsolidadoGuardado): Promise<void> {
  if (!globalThis.Buffer) {
    const { Buffer } = await import('buffer')
    globalThis.Buffer = Buffer
  }
  const d = c.datos
  const m = d.moneda
  const r = d.resumen
  const wb = new ExcelJS.Workbook()
  wb.creator = 'M.A.D.Y'
  wb.created = new Date()

  // Resumen: primero los datos de la revisión y luego las cifras.
  const ws = wb.addWorksheet('Resumen')
  ws.columns = [{ width: 36 }, { width: 24 }]
  const estado = d.preliminar || d.en_curso || c.preliminar ? 'Preliminar' : c.estado === 'finalizado' ? 'Finalizado' : c.estado === 'sustituido' ? 'Sustituido' : 'Borrador'
  const info: [string, string][] = [
    ['Organización', textoSeguro(d.organizacion)],
    ['Mes', d.mes],
    ['Revisión', String(c.revision)],
    ['Estado', estado],
    ['Base', textoSeguro(d.base)],
    ['Estado de fuentes al', textoHora(d.as_of)],
    ['Generado por', textoSeguro(c.generado_por)],
    ['Generado en', textoHora(c.generado_en)],
    ['Moneda', m],
  ]
  info.forEach(([k, v]) => { const f = ws.addRow([k, v]); f.getCell(1).font = { bold: true } })
  ws.addRow([])
  const cab = ws.addRow(['Concepto', 'Importe'])
  cab.font = { bold: true }
  const cifras: [string, number][] = [
    ['Trabajadores', r.trabajadores],
    ['Percepciones', r.percepciones],
    ['Reembolsos', r.reembolsos],
    ['Descuentos', r.deducciones],
    ['Neto reconocido', r.neto_reconocido],
    ['Entregado: pagos', r.entregado_pagos],
    ['Entregado: anticipos', r.entregado_anticipos],
    ['Entregado: reversiones', r.reversiones],
    ['Entregado total', r.entregado_total],
    ['Aplicado a cortes', r.aplicado_a_cortes],
    ['Traspaso a préstamo', r.traspaso_a_prestamo],
    ['Por pagar inicial', r.por_pagar_inicial],
    ['Por pagar final', r.por_pagar_final],
    ['Anticipos sin aplicar al cierre', r.anticipos_sin_aplicar_final],
    ['Préstamos al cierre', r.prestamos_final],
  ]
  const fmtMoneda = `"${m === 'MXN' ? '$' : m + ' '}"#,##0.00;[Red]-"${m === 'MXN' ? '$' : m + ' '}"#,##0.00`
  cifras.forEach(([k, v], i) => {
    const f = ws.addRow([k, v])
    if (i > 0) f.getCell(2).numFmt = fmtMoneda
  })
  ws.views = [{ state: 'frozen', ySplit: info.length + 2 }]

  const mon = (header: string, key: string, width = 16): Col => ({ header, key, width, tipo: 'moneda' })
  hoja(wb, 'Trabajadores', [
    { header: 'Código', key: 'codigo', width: 10 }, { header: 'Trabajador', key: 'nombre', width: 30 },
    { header: 'Puesto', key: 'puesto', width: 20 }, { header: 'Activo', key: 'activo', width: 8 },
    { header: 'Sin movimiento', key: 'sin', width: 12 },
    mon('Inicial: por pagar', 'i1'), mon('Inicial: anticipos sin aplicar', 'i2'), mon('Inicial: préstamos', 'i3'),
    { header: 'Cortes aprobados', key: 'cortes', width: 10 }, { header: 'Cortes anulados', key: 'anul', width: 10 },
    mon('Percepciones', 'perc'), mon('Reembolsos', 'reem'), mon('Descuentos', 'desc'),
    mon('De ellos, recuperación de préstamo', 'recup'), mon('Neto reconocido', 'neto'),
    mon('Entregado: pagos', 'e1'), mon('Entregado: anticipos', 'e2'), mon('Entregado: reversiones', 'e3'), mon('Entregado total', 'e4'),
    mon('Aplicado a cortes', 'apl'), mon('Traspaso a préstamo', 'tras'),
    mon('Préstamos otorgados', 'po'), mon('Préstamos recuperados y ajustes', 'pr'),
    mon('Final: por pagar', 'f1'), mon('Final: anticipos sin aplicar', 'f2'), mon('Final: préstamos', 'f3'),
  ], d.trabajadores.map(t => ({
    codigo: textoSeguro(t.codigo), nombre: textoSeguro(t.nombre), puesto: textoSeguro(t.puesto), activo: t.activo ? 'Sí' : 'No',
    sin: t.sin_movimiento ? 'Sí' : 'No',
    i1: t.inicial.por_pagar, i2: t.inicial.anticipos_sin_aplicar, i3: t.inicial.prestamos,
    cortes: t.reconocido.cortes, anul: t.reconocido.cortes_anulados,
    perc: t.reconocido.percepciones, reem: t.reconocido.reembolsos, desc: t.reconocido.deducciones,
    recup: t.reconocido.de_ellas_recuperacion_prestamo, neto: t.reconocido.neto,
    e1: t.entregado.pagos, e2: t.entregado.anticipos, e3: t.entregado.reversiones, e4: t.entregado.total,
    apl: t.aplicado_a_cortes, tras: t.traspaso_a_prestamo,
    po: t.prestamos.otorgados, pr: t.prestamos.recuperados_y_ajustes,
    f1: t.final.por_pagar, f2: t.final.anticipos_sin_aplicar, f3: t.final.prestamos,
  })), m)

  hoja(wb, 'Dinero del mes', [
    { header: 'Fecha de pago', key: 'fecha', width: 14, tipo: 'fecha' }, { header: 'Código', key: 'codigo', width: 10 },
    { header: 'Trabajador', key: 'nombre', width: 30 }, { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'Método', key: 'metodo', width: 14 }, { header: 'Referencia', key: 'ref', width: 20 },
    { header: 'Corte', key: 'corte', width: 18 }, { header: 'Semana inicio', key: 'si', width: 14, tipo: 'fecha' },
    { header: 'Semana fin', key: 'sf', width: 14, tipo: 'fecha' }, mon('Monto', 'monto'),
    { header: 'Motivo', key: 'motivo', width: 36 },
  ], d.movimientos.map(x => ({
    fecha: aFecha(x.fecha_pago), codigo: textoSeguro(x.codigo), nombre: textoSeguro(x.nombre), tipo: TIPO_MOV[x.tipo] ?? x.tipo,
    metodo: etiquetaMetodo(x.metodo), ref: textoSeguro(x.referencia), corte: textoSeguro(x.folio_corte),
    si: aFecha(x.semana_inicio), sf: aFecha(x.semana_fin), monto: x.monto, motivo: textoSeguro(x.motivo),
  })), m)

  hoja(wb, 'Cortes del mes', [
    { header: 'Folio', key: 'folio', width: 18 }, { header: 'Código', key: 'codigo', width: 10 },
    { header: 'Trabajador', key: 'nombre', width: 30 }, { header: 'Evento', key: 'evento', width: 11 },
    { header: 'Fecha', key: 'fecha', width: 14, tipo: 'fecha' },
    { header: 'Semana inicio', key: 'si', width: 14, tipo: 'fecha' }, { header: 'Semana fin', key: 'sf', width: 14, tipo: 'fecha' },
    mon('Percepciones', 'perc'), mon('Reembolsos', 'reem'), mon('Descuentos', 'desc'), mon('Neto', 'neto'),
    mon('Exceso de anticipo', 'exc'), { header: 'Motivo', key: 'motivo', width: 36 },
  ], d.cortes.map(x => ({
    folio: textoSeguro(x.folio), codigo: textoSeguro(x.codigo), nombre: textoSeguro(x.nombre),
    evento: x.evento === 'anulado' ? 'Anulado' : 'Aprobado', fecha: aFecha(x.fecha),
    si: aFecha(x.semana_inicio), sf: aFecha(x.semana_fin),
    perc: x.percepciones, reem: x.reembolsos, desc: x.deducciones, neto: x.neto, exc: x.exceso_anticipo,
    motivo: textoSeguro(x.motivo),
  })), m)

  hoja(wb, 'Incidencias', [
    { header: 'Tipo', key: 'tipo', width: 10 }, { header: 'Código', key: 'codigo', width: 30 },
    { header: 'Mensaje', key: 'msg', width: 80 },
  ], d.incidencias.map(i => ({ tipo: i.bloquea ? 'Bloquea' : 'Aviso', codigo: textoSeguro(i.codigo), msg: textoSeguro(i.mensaje) })), m)

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nombreArchivoConsolidadoExcel(c)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
