// PDF M42 — Entradas y salidas de material de empaque (diseño nuevo: lib/pdf/disenoNuevo).
import { Document, View, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface M42MovimientoPDF {
  orgNombre: string
  instalacion: string
  empresa: string | null
  fecha: string
  folio?: string | null
  descripcion_material: string | null
  entrada: number | null
  salida: number | null
  total: number | null
  entrega: string | null
  recibe: string | null
  mat_integro: boolean
  mat_buen_estado: boolean
  mat_limpio: boolean
  mat_libre_olores: boolean
  mat_libre_plagas: boolean
  mat_otros: string | null
  tr_integro: boolean
  tr_buen_estado: boolean
  tr_limpio: boolean
  tr_libre_olores: boolean
  tr_libre_plagas: boolean
  tr_otros: string | null
  observaciones: string | null
}

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

const sn = (v: boolean) => v ? 'Si' : 'No'
const nn = (v: number | null | undefined) => v != null ? String(v) : '—'

const COLS: ColumnaDato[] = [
  { texto: 'Descripción del material', ancho: 180 },
  { texto: 'Entrada', ancho: 60, align: 'center' },
  { texto: 'Salida', ancho: 60, align: 'center' },
  { texto: 'Total', ancho: 60, align: 'center' },
  { texto: 'Entrega', ancho: 200 },
  { texto: 'Recibe', ancho: 200 },
]

function ChecklistBlock({ d, tipo }: { d: M42MovimientoPDF; tipo: 'mat' | 'tr' }) {
  const integro = tipo === 'mat' ? d.mat_integro    : d.tr_integro
  const buen    = tipo === 'mat' ? d.mat_buen_estado : d.tr_buen_estado
  const limpio  = tipo === 'mat' ? d.mat_limpio     : d.tr_limpio
  const olores  = tipo === 'mat' ? d.mat_libre_olores : d.tr_libre_olores
  const plagas  = tipo === 'mat' ? d.mat_libre_plagas : d.tr_libre_plagas
  const otros   = tipo === 'mat' ? d.mat_otros      : d.tr_otros
  const titulo  = tipo === 'mat' ? 'Condición del material' : 'Condición del transporte'

  return (
    <View wrap={false} style={{ flex: 1, backgroundColor: PC.m13Fondo, borderRadius: 6, padding: 8 }}>
      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: PC.m13Navy, marginBottom: 4 }}>{titulo}</Text>
      {([
        ['Integro', integro],
        ['En buen estado', buen],
        ['Limpio', limpio],
        ['Libre de malos olores', olores],
        ['Libre de plagas', plagas],
      ] as [string, boolean][]).map(([label, val]) => (
        <View key={label} style={{ flexDirection: 'row', marginBottom: 2 }}>
          <Text style={{ fontSize: 7.5, color: PC.textSub, width: 110 }}>{label}:</Text>
          <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: val ? PC.m13Navy : PC.negativo }}>{sn(val)}</Text>
        </View>
      ))}
      {otros ? (
        <View style={{ marginTop: 3 }}>
          <Text style={{ fontSize: 7, color: PC.textSub }}>Otros: {otros}</Text>
        </View>
      ) : null}
    </View>
  )
}

export function MaterialEmpaquePDF({
  d, codigoClave, firmaRealizo, firmaVerifico,
}: {
  d: M42MovimientoPDF
  codigoClave: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}) {
  const codigoFmt = codigoFormato('F-FRUS-PRO-03', codigoClave)

  return (
    <Document>
      <PaginaEstandar
        titulo="ENTRADAS Y SALIDAS DE MATERIAL DE EMPAQUE"
        subtitulo={`${d.instalacion}${d.empresa ? ` | ${d.empresa}` : ''} | ${fmtFecha(d.fecha)}`}
        codigoFmt={codigoFmt}
        folio={d.folio ?? '—'}
        emision={d.fecha}
        etiquetaEmision="Fecha"
        camposDatos={[]}
      >
        <Seccion titulo="DATOS DEL MOVIMIENTO">
          <TablaDatos
            columnas={COLS}
            filas={[[d.descripcion_material ?? '—', nn(d.entrada), nn(d.salida), nn(d.total), d.entrega ?? '—', d.recibe ?? '—']]}
          />
        </Seccion>

        {/* Condiciones del material y del transporte */}
        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
          <View style={{ flex: 1, marginRight: 16 }}><ChecklistBlock d={d} tipo="mat" /></View>
          <View style={{ flex: 1 }}><ChecklistBlock d={d} tipo="tr" /></View>
        </View>

        {d.observaciones ? <FranjaDatos campos={[{ etiqueta: 'Observaciones', valor: d.observaciones }]} /> : null}

        <PdfFirmas
          signatures={[
            { label: 'Responsable de la instalacion', nombre: firmaRealizo?.firmante ?? '', caption: 'Firma del responsable', firma: firmaRealizo ?? null },
            { label: 'Responsable de la empresa', nombre: firmaVerifico?.firmante ?? '', caption: 'Responsable de Inocuidad — Firma', firma: firmaVerifico ?? null },
          ]}
        />
      </PaginaEstandar>
    </Document>
  )
}
