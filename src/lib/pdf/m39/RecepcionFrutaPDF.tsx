// PDF M39 — Recepción diaria de fruta, variante Cuarto Frío (diseño nuevo: lib/pdf/disenoNuevo).
import { Document, View, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

export interface M39LineaPDF {
  orden: number
  hora: string | null
  codigo_productor: string | null
  tipo: 'organico' | 'convencional'
  pase_anden: boolean
  producto: string | null
  cant_6oz: number | null
  cant_12oz: number | null
  cant_18oz: number | null
}

export interface M39RecepcionDataPDF {
  orgNombre: string
  instalacion: string
  fecha: string
  empresa: string | null
  observaciones: string | null
  lineas: M39LineaPDF[]
}

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

const t = (v: string | null | undefined): string => v ?? '—'
const n = (v: number | null | undefined): string => v != null ? String(v) : '0'

const COLS: ColumnaDato[] = [
  { texto: 'No.', ancho: 22, align: 'center' },
  { texto: 'Hora', ancho: 38 },
  { texto: 'Cod. Productor', ancho: 62 },
  { texto: 'Tipo', ancho: 36 },
  { texto: 'Pase Anden', ancho: 44, align: 'center' },
  { texto: 'Producto', ancho: 200 },
  { texto: '6 oz', ancho: 36, align: 'center' },
  { texto: '12 oz', ancho: 36, align: 'center' },
  { texto: '18 oz', ancho: 36, align: 'center' },
]

function CajaTotales({ titulo, filas }: { titulo: string; filas: readonly (readonly [string, number])[] }) {
  return (
    <View wrap={false} style={{ flex: 1, marginRight: 12, backgroundColor: PC.m13Fondo, borderRadius: 6, padding: 8 }}>
      <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.m13Navy, marginBottom: 4 }}>{titulo}</Text>
      {filas.map(([lbl, val]) => (
        <View key={lbl} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text style={{ fontSize: 7, color: PC.textSub }}>{lbl}</Text>
          <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.fieldValue }}>{val}</Text>
        </View>
      ))}
    </View>
  )
}

export function RecepcionFrutaPDF({ d, codigoClave }: { d: M39RecepcionDataPDF; codigoClave: string }) {
  const sumAll = (field: keyof M39LineaPDF) =>
    d.lineas.reduce((acc, l) => acc + ((l[field] as number) ?? 0), 0)
  const sumAnden = (field: keyof M39LineaPDF) =>
    d.lineas.filter(l => l.pase_anden).reduce((acc, l) => acc + ((l[field] as number) ?? 0), 0)

  const t6 = sumAll('cant_6oz');  const t12 = sumAll('cant_12oz');  const t18 = sumAll('cant_18oz')
  const a6 = sumAnden('cant_6oz'); const a12 = sumAnden('cant_12oz'); const a18 = sumAnden('cant_18oz')
  const codigoFmt = codigoFormato('F-FRUS-PRO-02', codigoClave)

  return (
    <Document>
      <PaginaEstandar
        trio={false}
        titulo="RECEPCIÓN DIARIA DE FRUTA"
        subtitulo={d.orgNombre}
        codigoFmt={codigoFmt}
        folio={fmtFecha(d.fecha)}
        emision={fmtFecha(d.fecha)}
        detalleCompacto={`${codigoFmt}  |  ${d.instalacion}  |  ${fmtFecha(d.fecha)}`}
        camposDatos={[
          { icono: 'codigo', etiqueta: 'Formato', valor: codigoFmt },
          { icono: 'ubicacion', etiqueta: 'Instalación', valor: d.instalacion },
          ...(d.empresa ? [{ etiqueta: 'Empresa', valor: d.empresa }] : []),
          { icono: 'calendario', etiqueta: 'Fecha', valor: fmtFecha(d.fecha) },
        ]}
      >
        <Seccion titulo="LÍNEAS DE RECEPCIÓN">
          <TablaDatos
            columnas={COLS}
            fuente={7.5}
            filas={d.lineas.map((l) => [
              String(l.orden),
              t(l.hora),
              t(l.codigo_productor),
              l.tipo === 'organico' ? 'Org' : 'Conv',
              l.pase_anden ? 'Si' : 'No',
              t(l.producto),
              n(l.cant_6oz),
              n(l.cant_12oz),
              n(l.cant_18oz),
            ])}
          />
        </Seccion>

        {/* Bloques de totales */}
        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
          <CajaTotales titulo="Inventario total recepción del día" filas={[['6 oz', t6], ['12 oz', t12], ['18 oz', t18]]} />
          <CajaTotales titulo="Inventario total pase aduanal" filas={[['6 oz', a6], ['12 oz', a12], ['18 oz', a18]]} />
        </View>

        {d.observaciones ? <FranjaDatos campos={[{ etiqueta: 'Observaciones', valor: d.observaciones }]} /> : null}

        <PdfFirmas
          signatures={[
            { label: '', nombre: '', caption: 'Responsable de la instalacion' },
            { label: '', nombre: '', caption: 'Responsable de la empresa' },
          ]}
        />
      </PaginaEstandar>
    </Document>
  )
}
