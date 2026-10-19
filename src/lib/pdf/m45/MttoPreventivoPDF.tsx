// PATRÓN INOCUIDAD — PDF M45 (plantilla homogénea M.A.D.Y)
// Verificación y mantenimiento preventivo y correctivo — A4 landscape, matriz mensual extendida.

import { Document, View, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { Leyenda } from '@/lib/pdf/disenoNuevo/Leyenda'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { estiloColumnaCompacta } from '@/lib/pdf/disenoNuevo/Encabezado'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'

export interface M45ItemPDFRow {
  id: string
  nombre: string
  frecuencia: string | null
  orden: number
}

export interface M45AreaPDF {
  area: string
  items: M45ItemPDFRow[]
}

export interface M45AccionesPDF {
  revision_general: boolean
  cambio_aceites: boolean
  cambio_piezas: boolean
  revision_electrico: boolean
}

export interface M45PaginaProps {
  instalacion: string
  instalacionCodigo: string
  anio: number
  mes: number
  mesLabel: string
  observaciones: string | null
  areas: M45AreaPDF[]
  resultados: Record<string, Record<number, string>>
  acciones: Record<string, M45AccionesPDF>
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface MttoPreventivoConsolidadoPDFProps {
  paginas: M45PaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

const H_COLOR  = PC.m13Navy
const N_COLOR  = PC.negativo

// A4 horizontal con márgenes de 40 pt (761.89 pt útiles). Anchos de columna fijos y
// la columna de cada día se calcula con lo que sobra.
const PAGE_W   = 841.89 - 80
const ITEM_COL = 150
const FREC_COL = 46
const ACT_COL  = 24

const diaColW = (nDias: number) => Math.floor((PAGE_W - ITEM_COL - FREC_COL - ACT_COL * 4) / Math.max(nDias, 1))

function diasDelMes(anio: number, mes: number): number[] {
  const total = new Date(anio, mes, 0).getDate()
  const arr: number[] = []
  for (let i = 1; i <= total; i++) arr.push(i)
  return arr
}

function frecLabel(f: string | null): string {
  if (!f) return ''
  if (f === 'diario')     return 'Diario'
  if (f === 'tercer_dia') return '3er dia'
  if (f === 'semanal')    return 'Semanal'
  if (f === 'quincenal')  return 'Quincenal'
  return f
}

function valorSym(v: string | undefined): string {
  if (v === 'hecho')    return 'H'
  if (v === 'no_hecho') return 'N'
  if (v === 'na')       return '—'
  return ''
}

function valorColor(v: string | undefined): string {
  if (v === 'hecho')    return H_COLOR
  if (v === 'no_hecho') return N_COLOR
  return PC.textSub
}

const LINEA = 0.5
const celda = { borderRightWidth: LINEA, borderRightColor: PC.border, borderBottomWidth: LINEA, borderBottomColor: PC.border } as const
const fila = { flexDirection: 'row', borderLeftWidth: LINEA, borderLeftColor: PC.border } as const
const ACT_HDR = ['Rev.\nGral', 'C.\nAceit', 'C.\nPzas', 'Rev.\nElec']

function MttoPreventivoPagina({
  instalacion, instalacionCodigo, anio, mes, mesLabel, observaciones,
  areas, resultados, acciones, codigoClave, terminoSitio = 'Instalación',
  firmaRealizo, firmaVerifico,
}: M45PaginaProps) {
  const codigoFmt = codigoFormato('F-FRUS-MTT-03', codigoClave)
  const dias = diasDelMes(anio, mes)
  const DAY_COL = diaColW(dias.length)

  return (
    <PaginaEstandar
      trio={false}
      titulo="VERIFICACIÓN, MANTENIMIENTO PREVENTIVO Y CORRECTIVO"
      subtitulo={`${codigoFmt}  |  ${instalacion}  |  ${mesLabel}`}
      codigoFmt={codigoFmt}
      folio={mesLabel}
      emision={mesLabel}
      detalleCompacto={`${codigoFmt}  |  ${instalacion}  |  ${mesLabel}`}
      columnasCompactas={
        <>
          <Text style={{ ...estiloColumnaCompacta, fontSize: 5.5, width: ITEM_COL, paddingLeft: 3 }}>Equipo / Elemento</Text>
          <Text style={{ ...estiloColumnaCompacta, fontSize: 5.5, width: FREC_COL, textAlign: 'center' }}>Frecuencia</Text>
          {dias.map((d) => (
            <Text key={d} style={{ ...estiloColumnaCompacta, fontSize: 5.5, width: DAY_COL, textAlign: 'center' }}>{d}</Text>
          ))}
          {ACT_HDR.map((h) => (
            <Text key={h} style={{ ...estiloColumnaCompacta, fontSize: 5, width: ACT_COL, textAlign: 'center' }}>{h}</Text>
          ))}
        </>
      }
      tituloDatos="1. DATOS DEL SITIO Y MES"
      camposDatos={[
        { icono: 'codigo', etiqueta: 'Formato', valor: codigoFmt },
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: instalacion },
        { icono: 'codigo', etiqueta: 'Código', valor: instalacionCodigo || '—' },
        { icono: 'calendario', etiqueta: 'Año', valor: String(anio) },
        { icono: 'calendario', etiqueta: 'Mes', valor: mesLabel },
      ]}
      porRenglon={5}
    >
      <Leyenda
        entradas={[
          {
            titulo: 'Valores de registro',
            items: [
              { codigo: 'H', label: 'Hecho' },
              { codigo: 'N', label: 'No hecho' },
              { codigo: '—', label: 'N/A' },
              { codigo: 'X', label: 'Accion realizada' },
            ],
          },
          {
            titulo: 'Columnas de accion',
            items: [
              { codigo: 'Rev.Gral', label: 'Revision general' },
              { codigo: 'C.Aceit', label: 'Cambio de aceites' },
              { codigo: 'C.Pzas', label: 'Cambio de piezas' },
              { codigo: 'Rev.Elec', label: 'Revision electrica' },
            ],
          },
        ]}
      />

      <Seccion titulo="2. ACTIVIDADES DE VERIFICACIÓN Y MANTENIMIENTO">
        {areas.map((areaData) => (
          <View key={areaData.area} style={{ marginBottom: 6 }}>
            {/* Banda de área */}
            <View
              wrap={false}
              minPresenceAhead={50}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: PC.m13MentaSuave, paddingVertical: 3, paddingRight: 4 }}
            >
              <View style={{ width: 2.5, alignSelf: 'stretch', backgroundColor: PC.m13Menta, marginRight: 4 }} />
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.m13Navy }} hyphenationCallback={partirPalabraLarga}>
                {areaData.area.toUpperCase()}
              </Text>
            </View>

            {/* Encabezado de columnas */}
            <View wrap={false} style={{ ...fila, backgroundColor: PC.m13Fondo, borderTopWidth: LINEA, borderTopColor: PC.border }}>
              <View style={{ ...celda, width: ITEM_COL, paddingVertical: 2, paddingLeft: 3, justifyContent: 'center' }}>
                <Text style={{ fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: PC.m13Navy }}>Equipo / Elemento</Text>
              </View>
              <View style={{ ...celda, width: FREC_COL, paddingVertical: 2, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: PC.m13Navy }}>Frecuencia</Text>
              </View>
              {dias.map((d) => (
                <View key={d} style={{ ...celda, width: DAY_COL, paddingVertical: 2, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: PC.m13Navy }}>{d}</Text>
                </View>
              ))}
              {ACT_HDR.map((h) => (
                <View key={h} style={{ ...celda, width: ACT_COL, paddingVertical: 2, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 5, fontFamily: 'Helvetica-Bold', color: PC.m13Navy, textAlign: 'center' }}>{h}</Text>
                </View>
              ))}
            </View>

            {/* Filas de ítems */}
            {areaData.items.map((item, idx) => {
              const bg  = idx % 2 === 0 ? PC.white : PC.m13Fondo
              const acc = acciones[item.id]
              const marcas = [acc?.revision_general, acc?.cambio_aceites, acc?.cambio_piezas, acc?.revision_electrico]
              return (
                <View key={item.id} wrap={false} style={{ ...fila, backgroundColor: bg }}>
                  <View style={{ ...celda, width: ITEM_COL, paddingVertical: 2, paddingLeft: 3, paddingRight: 2 }}>
                    <Text style={{ fontSize: 5.5, color: PC.fieldValue }} hyphenationCallback={partirPalabraLarga}>{item.nombre}</Text>
                  </View>
                  <View style={{ ...celda, width: FREC_COL, paddingVertical: 2, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 5, color: PC.textSub }}>{frecLabel(item.frecuencia)}</Text>
                  </View>
                  {dias.map((d) => {
                    const v   = resultados[item.id]?.[d]
                    const sym = valorSym(v)
                    return (
                      <View key={d} style={{ ...celda, width: DAY_COL, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 }}>
                        {sym ? (
                          <Text style={{ fontSize: sym === '—' ? 6 : 5.5, fontFamily: 'Helvetica-Bold', color: valorColor(v) }}>{sym}</Text>
                        ) : null}
                      </View>
                    )
                  })}
                  {marcas.map((m, k) => (
                    <View key={k} style={{ ...celda, width: ACT_COL, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 }}>
                      {m ? <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: H_COLOR }}>X</Text> : null}
                    </View>
                  ))}
                </View>
              )
            })}
          </View>
        ))}
      </Seccion>

      {observaciones ? <FranjaDatos campos={[{ etiqueta: 'Observaciones', valor: observaciones }]} /> : null}

      <View wrap={false}>
        <Seccion titulo="3. FIRMAS Y RESPONSABLES">
          <PdfFirmas
            signatures={[
              { label: '', nombre: '', caption: 'Responsable del Area', firma: firmaRealizo ?? null },
              { label: '', nombre: '', caption: 'Jefe de Mantenimiento', firma: firmaVerifico ?? null },
              { label: '', nombre: '', caption: 'Gerente de Operaciones' },
            ]}
          />
        </Seccion>
      </View>
    </PaginaEstandar>
  )
}

export function MttoPreventivoPDF(props: M45PaginaProps) {
  return (
    <Document
      title={`Mantenimiento Preventivo ${props.mesLabel}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Verificación y Mantenimiento Preventivo — ${props.instalacion}`}
      keywords="MADY, inocuidad, mantenimiento, preventivo, correctivo"
    >
      <MttoPreventivoPagina {...props} />
    </Document>
  )
}

export function MttoPreventivoConsolidadoPDF({
  paginas, instalacionNombre, desde, hasta,
}: MttoPreventivoConsolidadoPDFProps) {
  return (
    <Document
      title={`Mantenimiento Preventivo Consolidado — ${instalacionNombre} ${desde} a ${hasta}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Verificación y Mantenimiento Preventivo — ${instalacionNombre}`}
      keywords="MADY, inocuidad, mantenimiento, preventivo, correctivo, consolidado"
    >
      {paginas.map((p, i) => (
        <MttoPreventivoPagina key={i} {...p} />
      ))}
    </Document>
  )
}
