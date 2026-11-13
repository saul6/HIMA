// PDF M83 — Entradas y salidas de producto en pre enfriamiento (formato PRO-04). Diseño nuevo (lib/pdf/disenoNuevo).
// Un renglón por salida (las salidas parciales son renglones propios) + un renglón por saldo que sigue en prefrío.
// La turbina, el grupo y las lecturas individuales NO se imprimen (solo se conservan en M.A.D.Y.).
import { Document, View, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato, type CeldaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'
import type { M83Grupo } from '@/hooks/useM83Prefrio'
import { horaLocal, fechaLocal, duracionHHMM, fmtTemp } from './formatoPrefrio'

export interface M83DatosPDF {
  orgNombre: string
  fecha: string
  empresa: string
  grupos: M83Grupo[]   // del día y empresa, sin cancelados
}

// Anchos relativos: Fruta y Presentación llevan el espacio libre; tarimas, cajas, horas, temperaturas y tiempo, angostas.
const COLS: ColumnaDato[] = [
  { texto: 'Orgánico / Convencional', ancho: 44, align: 'center' },
  { texto: 'Fruta', ancho: 84 },
  { texto: 'Presentación', ancho: 200 },
  { texto: 'N° de tarimas', ancho: 30, align: 'center' },
  { texto: 'Total cajas', ancho: 30, align: 'center' },
  { texto: 'Entrada · Hora', ancho: 36, align: 'center' },
  { texto: 'Entrada · Temperatura', ancho: 46, align: 'center' },
  { texto: 'Salida · Hora', ancho: 40, align: 'center' },
  { texto: 'Salida · Temperatura', ancho: 46, align: 'center' },
  { texto: 'Tiempo total', ancho: 32, align: 'center' },
]

export function filasPrefrio(grupos: M83Grupo[]): CeldaDato[][] {
  const filas: CeldaDato[][] = []
  for (const g of grupos) {
    if (!g.entrada_en) continue   // declarado, aún sin entrar a prefrío
    const base = [g.clasificacion, g.fruta ?? '', g.combinada ? `Combinada: ${g.presentacion}` : `${g.presentacion} (#${g.codigo})`]
    const ent = [horaLocal(g.entrada_en), fmtTemp(g.temp_entrada_valor, g.temp_entrada_unidad)]
    const diaEnt = fechaLocal(g.entrada_en)
    for (const s of g.salidas) {
      const diaSal = fechaLocal(s.salida_en)
      const hs = horaLocal(s.salida_en) + (diaSal !== diaEnt ? ` (${fechaPdf(diaSal)})` : '')
      filas.push([...base, String(s.tarimas), String(s.cajas), ...ent, hs, fmtTemp(s.temp_salida_valor, s.temp_salida_unidad), duracionHHMM(s.duracion_min)])
    }
    if (g.estado === 'EN_PRE_FRIO' && g.quedan_tarimas > 0) {
      filas.push([...base, String(g.quedan_tarimas), String(g.quedan_cajas), ...ent,
        { texto: 'En prefrío', color: PC.textSub }, '', ''])
    }
  }
  return filas
}

export function PrefrioTurbinasPDF({ d, codigoClave }: { d: M83DatosPDF; codigoClave: string }) {
  const codigoFmt = codigoFormato('F-FRUS-PRO-04', codigoClave)
  const fecha = fechaPdf(d.fecha)
  return (
    <Document>
      <PaginaEstandar
        trio={false}
        titulo="ENTRADAS Y SALIDAS DE PRODUCTO EN PRE ENFRIAMIENTO"
        subtitulo={d.orgNombre}
        codigoFmt={codigoFmt}
        folio={fecha}
        emision={fecha}
        detalleCompacto={`${codigoFmt}  |  ${d.empresa}  |  ${fecha}`}
        camposDatos={[
          { icono: 'codigo', etiqueta: 'Formato', valor: codigoFmt },
          { etiqueta: 'Empresa', valor: d.empresa },
          { icono: 'calendario', etiqueta: 'Fecha', valor: fecha },
        ]}
      >
        <Seccion titulo="ENTRADAS Y SALIDAS">
          <TablaDatos columnas={COLS} filas={filasPrefrio(d.grupos)} fuente={7.5} vacio="Sin entradas a prefrío" />
        </Seccion>
        <View wrap={false}>
          <Text style={{ fontSize: 6.5, color: PC.textSub, marginTop: 6, marginBottom: 6 }}>
            Nota: Especificar si el producto es Orgánico (ORG) o Convencional (CONV). Temperaturas de fruta medidas con termómetro de vástago.
            Tiempo total en horas:minutos.
          </Text>
          <PdfFirmas
            signatures={[
              { label: '', nombre: '', caption: `Responsable ${d.orgNombre}`, firma: null },
              { label: '', nombre: '', caption: 'Responsable de la empresa', firma: null },
            ]}
          />
        </View>
      </PaginaEstandar>
    </Document>
  )
}
