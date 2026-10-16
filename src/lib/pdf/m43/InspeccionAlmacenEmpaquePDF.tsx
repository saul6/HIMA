// PATRÓN INOCUIDAD — PDF M43 (diseño nuevo: lib/pdf/disenoNuevo)
// Inspección de Almacén de Material de Empaque — A4 landscape, matriz mensual (C / NC / N/A).
import { Document, View, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { estiloColumnaCompacta } from '@/lib/pdf/disenoNuevo/Encabezado'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface M43PuntoPDFRow {
  id: string
  orden: number
  texto: string
}

export interface InspeccionAlmacenEmpaquePaginaProps {
  instalacion: string
  instalacionCodigo: string
  mesLabel: string
  mesDate: string
  realizadoPor: string | null
  verifica: string | null
  autoriza: string | null
  observaciones: string | null
  puntos: M43PuntoPDFRow[]
  diasInspeccionados: number[]
  matriz: Record<number, Record<string, string>>
  accionesTomadas: Record<number, string>
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface InspeccionAlmacenEmpaqueConsolidadoPDFProps {
  paginas: InspeccionAlmacenEmpaquePaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── Constantes ────────────────────────────────────────────────────────────────

// A4 horizontal con márgenes de 40 pt
const PAGE_W = 841.89 - 80
const PUNTO_COL = 250
const LINEA = 0.5

// ── Helpers ───────────────────────────────────────────────────────────────────

function dayColW(numDias: number): number {
  return Math.floor((PAGE_W - PUNTO_COL) / Math.max(numDias, 1))
}

function diasDelMes(mesDate: string): number[] {
  const d = new Date(mesDate + 'T12:00:00')
  const total = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return Array.from({ length: total }, (_, i) => i + 1)
}

function valorLabel(val: string): string {
  if (val === 'cumple')    return 'C'
  if (val === 'no_cumple') return 'NC'
  return 'N/A'
}

function valorColor(val: string): string {
  if (val === 'cumple')    return PC.m13Navy
  if (val === 'no_cumple') return PC.negativo
  return PC.textSub
}

const celda = { borderRightWidth: LINEA, borderRightColor: PC.border, borderBottomWidth: LINEA, borderBottomColor: PC.border } as const
const fila = { flexDirection: 'row', borderLeftWidth: LINEA, borderLeftColor: PC.border } as const

// ── InspeccionAlmacenEmpaquePagina ────────────────────────────────────────────

export function InspeccionAlmacenEmpaquePagina({
  instalacion, instalacionCodigo, mesLabel, mesDate,
  realizadoPor, verifica, autoriza, observaciones,
  puntos, diasInspeccionados, matriz, accionesTomadas,
  codigoClave, terminoSitio = 'Instalación',
  firmaRealizo, firmaVerifico,
}: InspeccionAlmacenEmpaquePaginaProps) {
  const emision  = new Date().toLocaleDateString('es-MX')
  const codigoFmt = codigoFormato('F-FRUS-PRO-08', codigoClave)
  const todosLosDias    = diasDelMes(mesDate)
  const dW              = dayColW(todosLosDias.length)
  const inspeccionadosSet = new Set(diasInspeccionados)

  const accionesEntries = (Object.entries(accionesTomadas) as [string, string][])
    .map(([k, v]) => [Number(k), v] as [number, string])
    .filter(([, v]) => v?.trim())
    .sort(([a], [b]) => a - b)

  const firmas = [
    { label: '', nombre: '', caption: realizadoPor ? `Realizado por: ${realizadoPor}` : 'Realizado por', firma: firmaRealizo ?? null },
    { label: '', nombre: '', caption: verifica ? `Verifica: ${verifica}` : 'Verifica: Responsable del Almacen', firma: firmaVerifico ?? null },
    ...(autoriza ? [{ label: '', nombre: '', caption: `Autoriza: ${autoriza}` }] : []),
  ]

  return (
    <PaginaEstandar
      titulo="INSPECCIÓN DE ALMACÉN DE MATERIAL DE EMPAQUE"
      subtitulo={`Inspeccion mensual | ${instalacion}`}
      codigoFmt={codigoFmt}
      folio={mesLabel}
      emision={emision}
      columnasCompactas={
        <>
          <Text style={{ ...estiloColumnaCompacta, fontSize: 6.5, width: PUNTO_COL, paddingLeft: 4 }}>Punto de inspeccion</Text>
          {todosLosDias.map((d) => (
            <Text key={d} style={{ ...estiloColumnaCompacta, fontSize: 6.5, width: dW, textAlign: 'center' }}>{d}</Text>
          ))}
        </>
      }
      tituloDatos="1. DATOS DEL SITIO Y MES"
      porRenglon={5}
      camposDatos={[
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: instalacion },
        { icono: 'codigo', etiqueta: 'Codigo', valor: instalacionCodigo || '—' },
        { icono: 'calendario', etiqueta: 'Mes / Año', valor: mesLabel },
        { icono: 'usuario', etiqueta: 'Realizado por', valor: realizadoPor ?? '—' },
        { icono: 'usuario', etiqueta: 'Verifica', valor: verifica ?? '—' },
        ...(autoriza ? [{ icono: 'usuario' as const, etiqueta: 'Autoriza', valor: autoriza }] : []),
      ]}
    >
      <Seccion titulo="2. PUNTOS DE INSPECCION">
        {/* Encabezado de la matriz */}
        <View wrap={false} style={{ ...fila, backgroundColor: PC.m13Fondo, borderTopWidth: LINEA, borderTopColor: PC.border }}>
          <View style={{ ...celda, width: PUNTO_COL, padding: 3, justifyContent: 'center' }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: PC.m13Navy }}>Punto de inspeccion</Text>
          </View>
          {todosLosDias.map((d) => (
            <View key={d} style={{ ...celda, width: dW, padding: 3, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: PC.m13Navy }}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Filas — un punto por fila */}
        {puntos.map((punto, idx) => (
          <View key={punto.id} wrap={false} style={{ ...fila, backgroundColor: idx % 2 === 1 ? PC.m13Fondo : PC.white }}>
            <View style={{ ...celda, width: PUNTO_COL, padding: 3 }}>
              <Text style={{ fontSize: 7, color: PC.fieldValue }} hyphenationCallback={partirPalabraLarga}>{punto.orden}. {punto.texto}</Text>
            </View>
            {todosLosDias.map((d) => {
              const rawVal = inspeccionadosSet.has(d) ? matriz[d]?.[punto.id] : undefined
              if (!rawVal) return <View key={d} style={{ ...celda, width: dW }} />
              const label = valorLabel(rawVal)
              return (
                <View key={d} style={{ ...celda, width: dW, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: label === 'NC' ? 5 : 6, fontFamily: 'Helvetica-Bold', color: valorColor(rawVal) }}>{label}</Text>
                </View>
              )
            })}
          </View>
        ))}
      </Seccion>

      {/* Acciones tomadas */}
      {accionesEntries.length > 0 && (
        <Seccion titulo="3. ACCIONES TOMADAS">
          <View style={{ backgroundColor: PC.m13Fondo, borderRadius: 6, padding: 8, marginBottom: 8 }}>
            {accionesEntries.map(([diaNum, texto]) => (
              <View key={diaNum} style={{ flexDirection: 'row', marginBottom: 2, alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PC.m13Navy, width: 32 }}>Dia {diaNum}:</Text>
                <Text style={{ fontSize: 6.5, color: PC.fieldValue, flex: 1 }} hyphenationCallback={partirPalabraLarga}>{texto}</Text>
              </View>
            ))}
          </View>
        </Seccion>
      )}

      {observaciones ? <FranjaDatos campos={[{ etiqueta: 'Observaciones', valor: observaciones }]} /> : null}

      <View wrap={false}>
        <Seccion titulo="4. FIRMAS Y RESPONSABLES">
          <PdfFirmas signatures={firmas} />
        </Seccion>
      </View>
    </PaginaEstandar>
  )
}

// ── Documentos exportables ────────────────────────────────────────────────────

export function InspeccionAlmacenEmpaquePDF(props: InspeccionAlmacenEmpaquePaginaProps) {
  return (
    <Document
      title={`Inspeccion Almacen Empaque — ${props.instalacion} ${props.mesLabel}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
    >
      <InspeccionAlmacenEmpaquePagina {...props} />
    </Document>
  )
}

export function InspeccionAlmacenEmpaqueConsolidadoPDF({
  paginas, instalacionNombre, desde, hasta,
}: InspeccionAlmacenEmpaqueConsolidadoPDFProps) {
  return (
    <Document
      title={`Inspeccion Almacen Empaque — ${instalacionNombre} ${desde} a ${hasta}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
    >
      {paginas.map((p, i) => (
        <InspeccionAlmacenEmpaquePagina key={i} {...p} />
      ))}
    </Document>
  )
}
