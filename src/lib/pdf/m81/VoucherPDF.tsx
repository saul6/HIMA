// PDF M81 — Voucher semanal de Actividades y pagos (diseño nuevo, una página A4 vertical).
// Todo importe sale tal cual lo calculó el servidor (nom_voucher); aquí solo se formatea.

import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion, fechaEmisionHoy } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, ANCHO_UTIL, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'
import { PC } from '@/lib/pdf/components/tokens'
import { etiquetaMetodo, etiquetaOrigenPrestamo, formatoMoneda } from '@/lib/nomina/formato'
import { formatFirmaFecha, type FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import type { FirmaVoucher, LineaCorte, NomPagoFila, VoucherData } from '@/types/nomina.types'

const ANCHO = ANCHO_UTIL.portrait

const ORIGEN: Record<string, string> = {
  perfil: 'modalidad base',
  trabajador: 'tarifa personal',
  organizacion: 'tarifa general',
  pactado: 'pactado',
}

/** "Pagado" solo si de verdad no hay pendiente. */
export function estadoPagoVoucher(pago: VoucherData['pago']): string {
  if (pago.estado_pago === 'sin_importe') return 'Sin importe'
  if (pago.pendiente <= 0.004 && pago.estado_pago === 'pagado') return 'Pagado'
  if (pago.entregado > 0 && pago.pendiente > 0.004) return 'Pago parcial'
  return 'Pendiente de pago'
}

const COLS_LINEAS: ColumnaDato[] = [
  { texto: 'Concepto', ancho: 150, align: 'left' },
  { texto: 'Cálculo', ancho: 250, align: 'left' },
  { texto: 'Importe', ancho: 100, align: 'right' },
]

function filasLineas(lineas: LineaCorte[], moneda: string, signo: '' | '-') {
  return lineas.map((l) => [
    l.fecha ? `${l.concepto} (${fechaPdf(l.fecha)})` : l.concepto,
    [l.formula, l.origen_tarifa ? ORIGEN[l.origen_tarifa] : null].filter(Boolean).join(' - '),
    `${signo}${formatoMoneda(Math.abs(l.monto), moneda)}`,
  ])
}

/** Firma del voucher al formato de PdfFirmas; sin firma digital, la línea queda en blanco. */
function firmaVoucherAParaPdf(f: FirmaVoucher | null | undefined): FirmaParaPdf | null {
  if (!f || !f.firma_png) return null
  return {
    png: f.firma_png,
    firmante: f.firmante,
    fecha: formatFirmaFecha(f.firmado_en),
    sello: (f.sello ?? '').slice(0, 12),
    estado: 'vigente',
  }
}

/** Caption con el nombre del firmante y, si aplica, cómo se capturó (la imagen no lleva nombre). */
function captionFirma(base: string, f: FirmaVoucher | null | undefined): string {
  if (!f || !f.firma_png) return base
  return [base, f.firmante, f.metodo === 'dispositivo' ? 'Firma capturada en dispositivo' : null].filter(Boolean).join('
')
}

export interface VoucherPDFProps {
  voucher: VoucherData
  codigoClave?: string
}

export function VoucherPagina({ voucher: v }: VoucherPDFProps) {
  const moneda = v.moneda
  const percepciones = v.lineas.filter((l) => l.tipo === 'percepcion')
  const reembolsos = v.lineas.filter((l) => l.tipo === 'reembolso')
  const descuentos = v.lineas.filter((l) => l.tipo === 'deduccion')
  const informativas = v.lineas.filter((l) => l.tipo === 'informativa')
  const pagosReales = (v.pagos ?? []) as NomPagoFila[]
  const estado = estadoPagoVoucher(v.pago)

  return (
    <PaginaEstandar
      orientacion="portrait"
      titulo="VOUCHER SEMANAL DE ACTIVIDADES Y PAGOS"
      subtitulo={`Voucher semanal | ${v.organizacion}`}
      codigoFmt="Voucher semanal"
      folio={`${v.folio} · R${v.revision}`}
      emision={fechaEmisionHoy()}
      tituloDatos="1. DATOS DEL TRABAJADOR"
      porRenglon={3}
      camposDatos={[
        { icono: 'usuario', etiqueta: 'Trabajador', valor: v.trabajador.nombre },
        { icono: 'codigo', etiqueta: 'Código', valor: v.trabajador.codigo },
        { etiqueta: 'Puesto', valor: v.trabajador.puesto || '—' },
        { icono: 'calendario', etiqueta: 'Periodo', valor: `${fechaPdf(v.periodo.inicio)} al ${fechaPdf(v.periodo.fin)}` },
        { etiqueta: 'Estado de pago', valor: estado },
      ]}
    >
      {percepciones.length > 0 && (
        <Seccion titulo="2. PERCEPCIONES">
          <TablaDatos columnas={COLS_LINEAS} anchoTotal={ANCHO} filas={filasLineas(percepciones, moneda, '')} />
        </Seccion>
      )}
      {reembolsos.length > 0 && (
        <Seccion titulo="3. REEMBOLSOS">
          <TablaDatos columnas={COLS_LINEAS} anchoTotal={ANCHO} filas={filasLineas(reembolsos, moneda, '')} />
        </Seccion>
      )}
      {descuentos.length > 0 && (
        <Seccion titulo="4. DESCUENTOS">
          <TablaDatos columnas={COLS_LINEAS} anchoTotal={ANCHO} filas={filasLineas(descuentos, moneda, '-')} />
        </Seccion>
      )}

      <Seccion titulo="5. RESUMEN DE LA SEMANA">
        <TablaDatos
          columnas={[{ texto: 'Concepto', ancho: 400, align: 'left' }, { texto: 'Importe', ancho: 100, align: 'right' }]}
          anchoTotal={ANCHO}
          filas={[
            ['Percepciones', formatoMoneda(v.totales.percepciones, moneda)],
            ['Reembolsos', formatoMoneda(v.totales.reembolsos, moneda)],
            ['Descuentos', `-${formatoMoneda(Math.abs(v.totales.deducciones), moneda)}`],
            [{ texto: 'Neto de la semana', negrita: true }, { texto: formatoMoneda(v.totales.neto, moneda), negrita: true }],
            ['Entregado', formatoMoneda(v.pago.entregado, moneda)],
            [{ texto: 'Pendiente', negrita: true }, { texto: formatoMoneda(v.pago.pendiente, moneda), negrita: true }],
          ]}
        />
      </Seccion>

      <Seccion titulo="6. PAGOS REGISTRADOS">
        <TablaDatos
          columnas={[
            { texto: 'Fecha de pago', ancho: 110, align: 'left' },
            { texto: 'Tipo', ancho: 110, align: 'left' },
            { texto: 'Método', ancho: 120, align: 'left' },
            { texto: 'Monto', ancho: 100, align: 'right' },
          ]}
          anchoTotal={ANCHO}
          vacio="Sin pagos registrados"
          filas={pagosReales.map((p) => [
            fechaPdf(p.fecha_pago),
            p.tipo === 'reversion' ? 'Reversión' : p.tipo === 'anticipo' ? 'Anticipo' : 'Pago',
            etiquetaMetodo(p.metodo),
            `${p.tipo === 'reversion' ? '-' : ''}${formatoMoneda(p.monto, moneda)}`,
          ])}
        />
      </Seccion>

      {v.prestamos_activos && v.prestamos_activos.length > 0 && (
        <Seccion titulo="7. PRÉSTAMOS CON SALDO">
          <TablaDatos
            columnas={[{ texto: 'Origen', ancho: 400, align: 'left' }, { texto: 'Saldo', ancho: 100, align: 'right' }]}
            anchoTotal={ANCHO}
            filas={v.prestamos_activos.map((p) => [
              etiquetaOrigenPrestamo(p.origen),
              { texto: formatoMoneda(p.saldo, moneda), color: PC.negativo, negrita: true },
            ])}
          />
        </Seccion>
      )}

      {informativas.length > 0 && (
        <Seccion titulo="8. ACTIVIDADES REGISTRADAS (NO SUMAN)">
          <TablaDatos
            columnas={[{ texto: 'Actividad', ancho: 250, align: 'left' }, { texto: 'Detalle', ancho: 250, align: 'left' }]}
            anchoTotal={ANCHO}
            filas={informativas.map((l) => [
              l.fecha ? `${l.concepto} (${fechaPdf(l.fecha)})` : l.concepto,
              l.formula ?? '',
            ])}
          />
        </Seccion>
      )}

      <Seccion titulo="FIRMAS">
        <PdfFirmas
          signatures={[
            { label: '', nombre: '', caption: captionFirma('Entregó - Firma', v.firmas?.entrego), firma: firmaVoucherAParaPdf(v.firmas?.entrego) },
            { label: '', nombre: '', caption: captionFirma('Recibí - Firma', v.firmas?.recibio), firma: firmaVoucherAParaPdf(v.firmas?.recibio) },
          ]}
        />
      </Seccion>
    </PaginaEstandar>
  )
}

export function VoucherPDF(props: VoucherPDFProps) {
  return (
    <Document title={`Voucher ${props.voucher.folio}`} author="M.A.D.Y">
      <VoucherPagina {...props} />
    </Document>
  )
}
