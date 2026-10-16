// PATRÓN INOCUIDAD — PDF M24 (plantilla homogénea M.A.D.Y)
// Control de Inventario de Químicos e Insumos — A4 portrait.
// PdfPageFrame + PdfHeader + tabla de movimientos + 3 firmas.

import { Document, View } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, ANCHO_UTIL, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { PC } from '@/lib/pdf/components/tokens'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface MovimientoPDF {
  fecha: string
  persona_solicita: string
  area: string
  tipo: 'entrada' | 'salida'
  cantidad: number
}

export interface InventarioQuimicosProps {
  instalacion: string
  quimicoNombre: string
  unidad: string
  movimientos: MovimientoPDF[]
  consolidado?: boolean
  desde?: string
  hasta?: string
  codigoClave?: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(f: string): string {
  if (!f) return '—'
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

function calcSaldo(movs: MovimientoPDF[]) {
  let saldo = 0
  return movs.map(m => {
    saldo = m.tipo === 'entrada' ? saldo + m.cantidad : saldo - m.cantidad
    return { ...m, saldo }
  })
}

// ── Columnas (anchos relativos; la tabla se escala al ancho útil de la hoja) ───

const COLS: ColumnaDato[] = [
  { texto: 'Fecha', ancho: 52, align: 'center' },
  { texto: 'Persona que solicita', ancho: 130 },
  { texto: 'Area', ancho: 100 },
  { texto: 'Entrada', ancho: 52, align: 'center' },
  { texto: 'Salida', ancho: 52, align: 'center' },
  { texto: 'Total', ancho: 52, align: 'center' },
]

// ── InventarioQuimicosPagina ──────────────────────────────────────────────────

export function InventarioQuimicosPagina({
  instalacion, quimicoNombre, unidad, movimientos,
  consolidado, desde, hasta, codigoClave, terminoSitio = 'Instalación',
  firmaRealizo, firmaVerifico,
}: InventarioQuimicosProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const codigoFmt = codigoFormato('F-FRUS-SAN-02', codigoClave ?? '')

  const filas = calcSaldo(movimientos)
  const periodo = consolidado && desde && hasta
    ? `${fmt(desde)} al ${fmt(hasta)}`
    : filas.length > 0
      ? `${fmt(filas[0].fecha)} al ${fmt(filas[filas.length - 1].fecha)}`
      : '—'

  return (
    <PaginaEstandar
      orientacion="portrait"
      titulo="CONTROL DE INVENTARIO DE QUÍMICOS E INSUMOS"
      subtitulo={`Formato operativo | ${instalacion}`}
      codigoFmt={codigoFmt}
      folio={emision}
      emision={emision}
      tituloDatos="1. DATOS DEL INVENTARIO"
      camposDatos={[
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: instalacion },
        { icono: 'calendario', etiqueta: 'Periodo', valor: periodo },
        { etiqueta: 'Quimico / Insumo', valor: quimicoNombre },
        { etiqueta: 'Unidad', valor: unidad },
      ]}
    >
      <Seccion titulo="2. MOVIMIENTOS">
        <TablaDatos
          columnas={COLS}
          anchoTotal={ANCHO_UTIL.portrait}
          vacio="Sin movimientos registrados"
          filas={filas.map((f) => [
            fmt(f.fecha),
            f.persona_solicita,
            f.area,
            f.tipo === 'entrada' ? String(f.cantidad) : '',
            f.tipo === 'salida' ? String(f.cantidad) : '',
            { texto: String(f.saldo), negrita: true, color: f.saldo < 0 ? PC.negativo : PC.fieldValue },
          ])}
        />
      </Seccion>

      <View wrap={false}>
        <Seccion titulo="3. FIRMAS Y RESPONSABLES">
          <PdfFirmas
            signatures={[
              { label: '', nombre: '', caption: 'Encargado de limpieza', firma: firmaRealizo ?? null },
              { label: '', nombre: '', caption: 'Gerente Administrativo', firma: firmaVerifico ?? null },
              { label: '', nombre: '', caption: 'Gerente General' },
            ]}
          />
        </Seccion>
      </View>
    </PaginaEstandar>
  )
}

// ── InventarioQuimicosPDF ─────────────────────────────────────────────────────

export function InventarioQuimicosPDF(props: InventarioQuimicosProps) {
  return (
    <Document
      title={`Inventario Quimicos ${props.quimicoNombre}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Control de Inventario de Químicos — ${props.instalacion}`}
      keywords="MADY, inocuidad, inventario, quimicos, insumos"
    >
      <InventarioQuimicosPagina {...props} />
    </Document>
  )
}
