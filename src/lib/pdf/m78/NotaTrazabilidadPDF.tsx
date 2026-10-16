// PDF M78 — Nota de trazabilidad GlobalG.A.P. (diseño nuevo: lib/pdf/disenoNuevo).
import { Document, View, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { Checklist } from '@/lib/pdf/disenoNuevo/Checklist'
import { TablaDatos, ANCHO_UTIL, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { PC } from '@/lib/pdf/components/tokens'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface NotaTrazabilidadPDFProps {
  folio: string | null
  fecha: string
  productor: string | null
  hora_salida: string | null
  num_camion: string | null
  zona: string | null
  rancho: string
  sector: string | null
  cultivo: string | null
  presentacion: string | null
  otro_presentacion: string | null
  peso_bruto: number | null
  peso_neto: number | null
  total_producto: string | null
  embarco: string | null
  chofer: string | null
  recibio: string | null
  observaciones: string | null
  orgNombre?: string | null
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface NotaTrazabilidadConsolidadaRow {
  folio: string | null
  fecha: string
  rancho: string
  sector: string | null
  cultivo: string | null
  presentacion: string | null
  peso_bruto: number | null
  peso_neto: number | null
  total_producto: string | null
  chofer: string | null
  recibio: string | null
}

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

const PRESENTACIONES = ['Caja', 'Tote', 'Granel', 'Otro'] as const

const COLS_PESOS: ColumnaDato[] = [
  { texto: 'PESO BRUTO (Ton)', ancho: 1, align: 'center' },
  { texto: 'PESO NETO (Ton)', ancho: 1, align: 'center' },
  { texto: 'TOTAL DE PRODUCTO', ancho: 1, align: 'center' },
  { texto: 'OBSERVACIONES', ancho: 1 },
]

export function NotaTrazabilidadPage({
  folio, fecha, productor, hora_salida, num_camion, zona, rancho, sector, cultivo,
  presentacion, otro_presentacion, observaciones, peso_bruto, peso_neto, total_producto,
  embarco, chofer, recibio, orgNombre, firmaRealizo, firmaVerifico,
}: NotaTrazabilidadPDFProps) {
  return (
    <PaginaEstandar
      orientacion="portrait"
      titulo="NOTA DE TRAZABILIDAD"
      subtitulo={`GlobalG.A.P. v6 | ${rancho}`}
      codigoFmt="NT"
      folio={folio ?? ''}
      emision={fmtFecha(fecha)}
      etiquetaEmision="Fecha"
      tituloDatos="DATOS GENERALES"
      camposDatos={[
        { icono: 'calendario', etiqueta: 'Fecha', valor: fmtFecha(fecha) },
        { icono: 'usuario', etiqueta: 'Productor', valor: productor ?? '' },
        { etiqueta: 'Hora de salida', valor: hora_salida ?? '' },
        { etiqueta: 'Num. camion', valor: num_camion ?? '' },
        { etiqueta: 'Zona', valor: zona ?? '' },
        { icono: 'ubicacion', etiqueta: 'Rancho', valor: rancho },
        { etiqueta: 'Sector', valor: sector ?? '' },
        { etiqueta: 'Cultivo', valor: cultivo ?? '' },
        ...(orgNombre ? [{ icono: 'usuario' as const, etiqueta: 'Organizacion', valor: orgNombre }] : []),
      ]}
    >
      <Seccion titulo="PRESENTACION">
        <Checklist
          items={PRESENTACIONES.map((p) => ({
            label: p === 'Otro' ? `OTRO: ${presentacion === 'Otro' ? (otro_presentacion ?? '') : ''}` : p.toUpperCase(),
            checked: presentacion === p,
          }))}
        />
      </Seccion>

      <Seccion titulo="PESOS Y OBSERVACIONES">
        <TablaDatos
          columnas={COLS_PESOS}
          anchoTotal={ANCHO_UTIL.portrait}
          fuente={9}
          filas={[[
            peso_bruto != null ? String(peso_bruto) : '',
            peso_neto != null ? String(peso_neto) : '',
            total_producto ?? '',
            observaciones ?? '',
          ]]}
        />
      </Seccion>

      <Seccion titulo="FIRMAS DE OPERACION">
        <View wrap={false} style={{ flexDirection: 'row', marginBottom: 8 }}>
          {[
            { label: 'EMBARCO', nombre: embarco },
            { label: 'CHOFER', nombre: chofer },
            { label: 'RECIBIO', nombre: recibio },
          ].map((f, i) => (
            <View key={f.label} style={{ flex: 1, marginRight: i < 2 ? 16 : 0 }}>
              <Text style={{ fontSize: 8, color: PC.fieldValue, fontFamily: 'Helvetica-Bold', marginBottom: 2, minHeight: 10 }} hyphenationCallback={partirPalabraLarga}>
                {f.nombre ?? ''}
              </Text>
              <View style={{ borderBottomWidth: 0.75, borderBottomColor: PC.m13Navy, width: '100%', height: 28 }} />
              <Text style={{ fontSize: 7, color: PC.fieldLabel, marginTop: 2 }}>{f.label}</Text>
              <Text style={{ fontSize: 6, color: PC.fieldLabel }}>Nombre y Firma</Text>
            </View>
          ))}
        </View>
      </Seccion>

      <PdfFirmas
        signatures={[
          { label: '', nombre: '', caption: 'Realizo', firma: firmaRealizo ?? null },
          { label: '', nombre: '', caption: 'Verifico', firma: firmaVerifico ?? null },
        ]}
      />
    </PaginaEstandar>
  )
}

export function NotaTrazabilidadPDF(props: NotaTrazabilidadPDFProps) {
  return (
    <Document>
      <NotaTrazabilidadPage {...props} />
    </Document>
  )
}

const COLS_CONSOLIDADO: ColumnaDato[] = [
  { texto: 'Folio', ancho: 40 },
  { texto: 'Fecha', ancho: 50 },
  { texto: 'Rancho', ancho: 80 },
  { texto: 'Sector', ancho: 50 },
  { texto: 'Cultivo', ancho: 60 },
  { texto: 'Presentacion', ancho: 50 },
  { texto: 'Peso Bruto', ancho: 45, align: 'center' },
  { texto: 'Peso Neto', ancho: 45, align: 'center' },
  { texto: 'Total', ancho: 55 },
  { texto: 'Chofer', ancho: 70 },
  { texto: 'Recibio', ancho: 60 },
]

export function NotaTrazabilidadConsolidadoPDF({
  rows,
  orgNombre,
  desde,
  hasta,
}: {
  rows: NotaTrazabilidadConsolidadaRow[]
  orgNombre?: string | null
  desde: string
  hasta: string
}) {
  return (
    <Document>
      <PaginaEstandar
        titulo="NOTA DE TRAZABILIDAD — CONSOLIDADO"
        subtitulo={`GlobalG.A.P. v6 | ${fmtFecha(desde)} al ${fmtFecha(hasta)}`}
        codigoFmt="NT"
        folio=""
        emision={fmtFecha(hasta)}
        etiquetaEmision="Fecha"
        camposDatos={orgNombre ? [{ icono: 'usuario', etiqueta: 'Organizacion', valor: orgNombre }] : []}
      >
        <TablaDatos
          columnas={COLS_CONSOLIDADO}
          fuente={7}
          fuenteEnc={6.5}
          filas={rows.map((row) => [
            row.folio ?? '',
            fmtFecha(row.fecha),
            row.rancho,
            row.sector ?? '',
            row.cultivo ?? '',
            row.presentacion ?? '',
            row.peso_bruto != null ? String(row.peso_bruto) : '',
            row.peso_neto != null ? String(row.peso_neto) : '',
            row.total_producto ?? '',
            row.chofer ?? '',
            row.recibio ?? '',
          ])}
        />
      </PaginaEstandar>
    </Document>
  )
}
