// PATRÓN INOCUIDAD — PDF M39 Almacén (diseño nuevo: lib/pdf/disenoNuevo)
// Recepción diaria de fruta (variante Almacén) — A4 landscape.
import { Document, View, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion, fechaEmisionHoy } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'

export interface M39LineaAlmacenPDF {
  orden: number
  hora: string | null
  cultivo: string | null
  cajas: number | null
  piezas: number | null
  entrega: string | null
  limp_be: boolean | null
  limp_l: boolean | null
  limp_lp: boolean | null
  codigo_trazabilidad: string | null
}

export interface M39RecepcionAlmacenDataPDF {
  orgNombre: string
  instalacion: string
  fecha: string
  hoja_no: string | null
  empresa: string | null
  observaciones: string | null
  lineas: M39LineaAlmacenPDF[]
}

function fmtFecha(iso: string): string { return fechaPdf(iso) }
const t  = (v: string | null | undefined): string => v ?? '—'
const n  = (v: number | null | undefined): string => v != null ? String(v) : '—'
const b3 = (v: boolean | null): string => v === true ? 'Si' : v === false ? 'No' : '—'

const COLS: ColumnaDato[] = [
  { texto: 'No.', ancho: 28, align: 'center' },
  { texto: 'Hora', ancho: 45 },
  { texto: 'Cultivo', ancho: 150 },
  { texto: 'Cajas', ancho: 50, align: 'center' },
  { texto: 'Piezas', ancho: 50, align: 'center' },
  { texto: 'Entrega', ancho: 120 },
  { texto: 'Limp. BE', ancho: 45, align: 'center' },
  { texto: 'Limp. L', ancho: 45, align: 'center' },
  { texto: 'Limp. LP', ancho: 45, align: 'center' },
  { texto: 'Código de trazabilidad', ancho: 170 },
]

export function RecepcionFrutaAlmacenPDF({
  d, codigoClave, terminoSitio = 'Instalación',
  firmaRealizo, firmaVerifico,
}: {
  d: M39RecepcionAlmacenDataPDF
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}) {
  const emision    = fechaEmisionHoy()
  const codigoFmt  = codigoFormato('F-FRUS-PRO-02', codigoClave)
  const fechaLabel = fmtFecha(d.fecha)

  const invCultivo: Record<string, { cajas: number; piezas: number }> = {}
  for (const l of d.lineas) {
    const k = l.cultivo?.trim() || 'Sin cultivo'
    if (!invCultivo[k]) invCultivo[k] = { cajas: 0, piezas: 0 }
    invCultivo[k].cajas  += l.cajas  ?? 0
    invCultivo[k].piezas += l.piezas ?? 0
  }
  const cultivoEntries = Object.entries(invCultivo)

  return (
    <Document
      title={`Recepcion Diaria de Fruta ${fechaLabel}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Recepción Diaria de Fruta — ${d.instalacion}`}
      keywords="MADY, inocuidad, recepcion, fruta, trazabilidad, almacen"
    >
      <PaginaEstandar
        titulo="RECEPCIÓN DIARIA DE FRUTA"
        subtitulo={`Formato operativo | ${d.instalacion}`}
        codigoFmt={codigoFmt}
        folio={fechaLabel}
        emision={emision}
        tituloDatos="1. DATOS DE RECEPCIÓN"
        camposDatos={[
          { icono: 'ubicacion', etiqueta: terminoSitio, valor: d.instalacion },
          { etiqueta: 'Empresa', valor: d.empresa || '—' },
          { icono: 'calendario', etiqueta: 'Fecha', valor: fechaLabel },
          ...(d.hoja_no ? [{ icono: 'folio' as const, etiqueta: 'Hoja No.', valor: d.hoja_no }] : []),
        ]}
      >
        <Seccion titulo="2. LÍNEAS DE RECEPCIÓN">
          <TablaDatos
            columnas={COLS}
            fuente={8}
            filas={d.lineas.map((linea) => [
              String(linea.orden),
              t(linea.hora),
              t(linea.cultivo),
              n(linea.cajas),
              n(linea.piezas),
              t(linea.entrega),
              b3(linea.limp_be),
              b3(linea.limp_l),
              b3(linea.limp_lp),
              { texto: linea.codigo_trazabilidad || '—', negrita: true, color: PC.m13Navy },
            ])}
          />
        </Seccion>

        {cultivoEntries.length > 0 && (
          <Seccion titulo="3. INVENTARIO POR CULTIVO">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
              {cultivoEntries.map(([cultivo, tot]) => (
                <View key={cultivo} wrap={false} style={{ minWidth: 110, marginRight: 8, marginBottom: 6, borderWidth: 0.5, borderColor: PC.border, borderRadius: 6, overflow: 'hidden' }}>
                  <View style={{ backgroundColor: PC.m13Fondo, paddingVertical: 3, paddingHorizontal: 6 }}>
                    <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.m13Navy }}>{cultivo}</Text>
                  </View>
                  <View style={{ padding: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                      <Text style={{ fontSize: 6.5, color: PC.textSub }}>Cajas:</Text>
                      <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: PC.fieldValue }}>{tot.cajas}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 6.5, color: PC.textSub }}>Piezas:</Text>
                      <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: PC.fieldValue }}>{tot.piezas}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </Seccion>
        )}

        {d.observaciones ? <FranjaDatos campos={[{ etiqueta: 'Observaciones', valor: d.observaciones }]} /> : null}

        <View wrap={false}>
          <Seccion titulo="4. FIRMAS Y RESPONSABLES">
            <PdfFirmas
              signatures={[
                { label: '', nombre: '', caption: 'Responsable de Empaque — Firma', firma: firmaRealizo ?? null },
                { label: '', nombre: '', caption: 'Responsable de la Empresa — Firma', firma: firmaVerifico ?? null },
              ]}
            />
          </Seccion>
        </View>
      </PaginaEstandar>
    </Document>
  )
}
