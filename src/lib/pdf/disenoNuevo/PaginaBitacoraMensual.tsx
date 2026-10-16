// Bitácora mensual de limpieza (M28–M35): matriz de actividades por día (OK / No / N/A),
// registro diario de personal (y de concentraciones, si el formato las lleva), observaciones
// y firmas. Cada módulo solo aporta su título, su código y su área; la cuadrícula del formato
// oficial (una columna por día) no cambia.
import { View, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from './PaginaEstandar'
import { FranjaDatos } from './Franja'
import { TablaDatos, type ColumnaDato, type CeldaDato } from './TablaDatos'
import { PdfFirmas } from './PdfFirmas'
import { estiloColumnaCompacta } from './Encabezado'
import { PC } from '@/lib/pdf/components/tokens'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export type ValorBitacora = 'hecho' | 'no_hecho' | 'na'

export interface ItemBitacora { id: string; nombre: string; frecuencia: string }

export interface DiaDataBitacora {
  concentracion_cloro?: number | null
  ajuste_cloro?: string | null
  concentracion_acido?: number | null
  ajuste_acido?: string | null
  realizo: string | null
  aprobo: string | null
}

export type TonoValor = 'ok' | 'mal' | 'neutro'

interface Props {
  titulo: string
  codigoFmt: string
  instalacion: string
  instalacionCodigo: string
  terminoSitio: string
  anio: number
  mes: number
  /** Campo "Área" de la franja; el M28 no lo lleva. */
  area?: string
  items: ItemBitacora[]
  resultados: Record<number, Record<string, ValorBitacora>>
  diasData: Record<number, DiaDataBitacora>
  /** true = el registro diario incluye concentraciones de cloro y ácido peracético. */
  conConcentraciones: boolean
  observaciones: string | null
  /** Valor de una celda distinto al estándar (OK / No / N/A) para ciertos ítems; null = usar el estándar. */
  formatoValor?: (v: ValorBitacora | undefined, item: any) => { texto: string; tono: TonoValor } | null
  /** Registro diario propio del formato (si el estándar de personal / concentraciones no aplica). */
  registroDiario?: { titulo: string; columnas: ColumnaDato[]; filas: CeldaDato[][] }
  /** Nota fija del formato, en una caja bajo la matriz (antes de las observaciones). */
  nota?: string
  /** true = la nota va después de las observaciones. */
  notaDespuesDeObs?: boolean
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

// A4 horizontal con márgenes de 40 pt
const PAGE_W = 841.89 - 80
const ITEM_COL_W = 160
const LINEA = 0.5

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
export const mesNombre = (anio: number, mes: number) => `${MESES[mes - 1]} ${anio}`

function valorDisplay(v: ValorBitacora | undefined): { texto: string; color: string } {
  if (v === 'hecho') return { texto: 'OK', color: PC.m13Navy }
  if (v === 'no_hecho') return { texto: 'No', color: PC.negativo }
  if (v === 'na') return { texto: 'N/A', color: PC.textSub }
  return { texto: '', color: PC.fieldValue }
}

const celda = { borderRightWidth: LINEA, borderRightColor: PC.border, borderBottomWidth: LINEA, borderBottomColor: PC.border } as const
const fila = { flexDirection: 'row', borderLeftWidth: LINEA, borderLeftColor: PC.border } as const

const COLS_CONC: ColumnaDato[] = [
  { texto: 'Dia', ancho: 20, align: 'center' },
  { texto: 'Conc. Cloro (ppm)', ancho: 60, align: 'center' },
  { texto: 'Ajuste Cloro', ancho: 60, align: 'center' },
  { texto: 'Conc. Ac. Per. (ppm)', ancho: 65, align: 'center' },
  { texto: 'Ajuste Ac. Per.', ancho: 60, align: 'center' },
  { texto: 'Realizo', ancho: 100, align: 'center' },
  { texto: 'Aprobo', ancho: 100, align: 'center' },
]
const COLS_PERSONAL: ColumnaDato[] = [
  { texto: 'Dia', ancho: 30, align: 'center' },
  { texto: 'Realizo', ancho: 250, align: 'center' },
  { texto: 'Aprobo', ancho: 250, align: 'center' },
]

export function PaginaBitacoraMensual({
  titulo, codigoFmt, instalacion, instalacionCodigo, terminoSitio, anio, mes, area, items, resultados, diasData,
  conConcentraciones, observaciones, formatoValor, registroDiario, nota, notaDespuesDeObs, firmaRealizo, firmaVerifico,
}: Props) {
  const notaCaja = nota ? (
    <View wrap={false} style={{ marginTop: 4, marginBottom: 6, padding: 6, borderRadius: 6, backgroundColor: PC.m13Fondo }}>
      <Text style={{ fontSize: 6, color: PC.textSub }}>{nota}</Text>
    </View>
  ) : null
  const emision = new Date().toLocaleDateString('es-MX')
  const numDias = new Date(anio, mes, 0).getDate()
  const days = Array.from({ length: numDias }, (_, i) => i + 1)
  const dW = Math.floor((PAGE_W - ITEM_COL_W) / Math.max(numDias, 1))
  const mesLabel = mesNombre(anio, mes)

  const dias = Object.keys(diasData).map(Number).filter((dia) => {
    const d = diasData[dia]
    return d.concentracion_cloro != null || d.ajuste_cloro || d.concentracion_acido != null || d.ajuste_acido || d.realizo || d.aprobo
  }).sort((a, b) => a - b)

  return (
    <PaginaEstandar
      titulo={titulo}
      subtitulo={`Bitácora mensual | ${instalacion}`}
      codigoFmt={codigoFmt}
      folio={mesLabel}
      emision={emision}
      columnasCompactas={
        <>
          <Text style={{ ...estiloColumnaCompacta, fontSize: 6.5, width: ITEM_COL_W, paddingLeft: 4 }}>Actividad / Frecuencia</Text>
          {days.map((d) => (
            <Text key={d} style={{ ...estiloColumnaCompacta, fontSize: 6.5, width: dW, textAlign: 'center' }}>{d}</Text>
          ))}
        </>
      }
      tituloDatos="1. DATOS DEL SITIO Y MES"
      camposDatos={[
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: instalacion },
        { icono: 'codigo', etiqueta: 'Código', valor: instalacionCodigo || '—' },
        ...(area ? [{ etiqueta: 'Área', valor: area }] : []),
        { icono: 'calendario', etiqueta: 'Mes / Año', valor: mesLabel },
      ]}
    >
      <Seccion titulo="2. ACTIVIDADES DE LIMPIEZA">
        <View wrap={false} style={{ ...fila, backgroundColor: PC.m13Fondo, borderTopWidth: LINEA, borderTopColor: PC.border }}>
          <View style={{ ...celda, width: ITEM_COL_W, padding: 3, justifyContent: 'center' }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: PC.m13Navy }}>Actividad / Frecuencia</Text>
          </View>
          {days.map((d) => (
            <View key={d} style={{ ...celda, width: dW, padding: 3, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: PC.m13Navy }}>{d}</Text>
            </View>
          ))}
        </View>
        {items.map((item, idx) => (
          <View key={item.id} wrap={false} style={{ ...fila, backgroundColor: idx % 2 === 1 ? PC.m13Fondo : PC.white }}>
            <View style={{ ...celda, width: ITEM_COL_W, padding: 3, justifyContent: 'center' }}>
              <Text style={{ fontSize: 6, color: PC.fieldValue }} hyphenationCallback={partirPalabraLarga}>{item.nombre}</Text>
              <Text style={{ fontSize: 5.5, color: PC.textSub, marginTop: 0.5 }}>Frec: {item.frecuencia}</Text>
            </View>
            {days.map((d) => {
              const v = resultados[d]?.[item.id]
              const custom = formatoValor?.(v, item)
              const { texto, color } = custom
                ? { texto: custom.texto, color: custom.tono === 'ok' ? PC.m13Navy : custom.tono === 'mal' ? PC.negativo : PC.textSub }
                : valorDisplay(v)
              return (
                <View key={d} style={{ ...celda, width: dW, padding: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 6, color, fontFamily: texto ? 'Helvetica-Bold' : 'Helvetica' }}>{texto}</Text>
                </View>
              )
            })}
          </View>
        ))}
      </Seccion>

      {registroDiario && registroDiario.filas.length > 0 && (
        <Seccion titulo={registroDiario.titulo}>
          <TablaDatos columnas={registroDiario.columnas} fuente={7} fuenteEnc={6.5} filas={registroDiario.filas} />
        </Seccion>
      )}

      {!registroDiario && dias.length > 0 && (
        <Seccion titulo={conConcentraciones ? 'REGISTRO DIARIO DE CONCENTRACIONES Y PERSONAL' : 'REGISTRO DIARIO DE PERSONAL'}>
          <TablaDatos
            columnas={conConcentraciones ? COLS_CONC : COLS_PERSONAL}
            fuente={7}
            fuenteEnc={6.5}
            filas={dias.map((dia) => {
              const d = diasData[dia]
              return conConcentraciones
                ? [
                    String(dia),
                    d.concentracion_cloro != null ? String(d.concentracion_cloro) : '',
                    d.ajuste_cloro ?? '',
                    d.concentracion_acido != null ? String(d.concentracion_acido) : '',
                    d.ajuste_acido ?? '',
                    d.realizo ?? '',
                    d.aprobo ?? '',
                  ]
                : [String(dia), d.realizo ?? '', d.aprobo ?? '']
            })}
          />
        </Seccion>
      )}

      {!notaDespuesDeObs ? notaCaja : null}
      {observaciones ? <FranjaDatos campos={[{ etiqueta: 'Observaciones', valor: observaciones }]} /> : null}
      {notaDespuesDeObs ? notaCaja : null}

      <View wrap={false}>
        <Seccion titulo="3. FIRMAS Y RESPONSABLES">
          <PdfFirmas
            signatures={[
              { label: '', nombre: '', caption: 'Realizo', firma: firmaRealizo ?? null },
              { label: '', nombre: '', caption: 'Aprobo', firma: firmaVerifico ?? null },
              { label: '', nombre: '', caption: 'Responsable de Inocuidad — Firma' },
            ]}
          />
        </Seccion>
      </View>
    </PaginaEstandar>
  )
}
