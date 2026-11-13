// PDF M85 — Registro de temperaturas del conservador (formato PRO-05): cinco bloques de fecha por hoja,
// columnas 01:00–24:00, renglones Temperatura y Realizó, y Observaciones. Si hacen falta más bloques, sigue otra hoja igual.
import { Document, View, Text } from '@react-pdf/renderer'
import { PaginaEstandar } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'
import { proyectarBloques, observacionesBloque, fmtF, type Bloque, type LecturaBase, type Verificacion } from './conservadorLogica'

export interface M85DatosPDF {
  orgNombre: string
  empresa: string
  desde: string
  hasta: string
  limites: { min: number; max: number }
  unidad: 'C' | 'F'
  lecturas: LecturaBase[]
  verificaciones: Verificacion[]
}

const ANCHO = 841.89 - 80
const ETQ = 58
const COL = (ANCHO - ETQ) / 24
const borde = { borderColor: PC.border, borderWidth: 0.5 }

function Celda({ txt, ancho, negrita, color, fondo }: { txt: string; ancho: number; negrita?: boolean; color?: string; fondo?: string }) {
  return (
    <View style={{ width: ancho, height: 13, justifyContent: 'center', alignItems: 'center', ...borde, backgroundColor: fondo }}>
      <Text style={{ fontSize: 6.2, fontFamily: negrita ? 'Helvetica-Bold' : 'Helvetica', color: color ?? PC.fieldValue }}>{txt}</Text>
    </View>
  )
}

function BloqueFecha({ b, limites, verif, unidad }: { b: Bloque; limites: { min: number; max: number }; verif?: Verificacion | null; unidad: 'C' | 'F' }) {
  const cols = Array.from({ length: 24 }, (_, i) => i + 1)
  const obs = observacionesBloque(b, limites, verif)
  return (
    <View wrap={false} style={{ marginBottom: 7 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 }}>
        <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.fieldValue }}>Fecha: {fechaPdf(b.fecha)}</Text>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <Celda txt="Hora" ancho={ETQ} negrita fondo={PC.m13Fondo} />
        {cols.map(c => <Celda key={c} txt={`${String(c).padStart(2, '0')}:00`} ancho={COL} negrita fondo={PC.m13Fondo} />)}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <Celda txt={`Temperatura °${unidad}`} ancho={ETQ} negrita />
        {cols.map(c => {
          const l = b.celdas.get(c)
          const fuera = l ? l.temperatura < limites.min || l.temperatura > limites.max : false
          return <Celda key={c} txt={l ? fmtF(l.temperatura) : ''} ancho={COL} color={fuera ? PC.negativo : undefined} />
        })}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <Celda txt="Realizó" ancho={ETQ} negrita />
        {cols.map(c => <Celda key={c} txt={b.celdas.get(c)?.iniciales ?? ''} ancho={COL} />)}
      </View>
      <View style={{ flexDirection: 'row', ...borde, borderTopWidth: 0, minHeight: 13, padding: 2 }}>
        <Text style={{ fontSize: 6.2, fontFamily: 'Helvetica-Bold', color: PC.fieldValue, width: ETQ - 4 }}>Observaciones:</Text>
        <Text style={{ fontSize: 6.2, color: PC.fieldValue, flex: 1 }}>{obs.join(' · ')}</Text>
      </View>
    </View>
  )
}

function Instrucciones({ d }: { d: M85DatosPDF }) {
  return (
    <View>
      <Text style={{ fontSize: 6.5, color: PC.textSub, marginTop: 4 }}>
        Instrucciones: Al iniciar el turno revisar la temperatura del conservador y registrarla en la hora correspondiente, posteriormente hacerlo
        cada dos horas durante la duración de la jornada laboral. Se debe especificar con las iniciales de la persona que realiza la actividad;
        en observaciones deben estar las iniciales con el nombre completo de quién realizó dicha actividad. Temperatura ambiente del conservador en °{d.unidad};
        intervalo operativo {d.limites.min}–{d.limites.max} °{d.unidad}. Horas en formato de 24 h.
      </Text>
      <PdfFirmas
        signatures={[
          { label: '', nombre: Array.from(new Set(d.lecturas.map(l => l.nombre_usuario))).join(', '), caption: 'Realizó', firma: null },
          { label: '', nombre: Array.from(new Set(d.verificaciones.map(v => v.nombre))).join(', '), caption: 'Verificó (encargado de turno)', firma: null },
        ]}
      />
    </View>
  )
}

export function TemperaturaConservadorPDF({ d, codigoClave }: { d: M85DatosPDF; codigoClave: string }) {
  const codigoFmt = codigoFormato('F-FRUS-PRO-05', codigoClave)
  const bloques = proyectarBloques(d.lecturas)
  const hojas: Bloque[][] = []
  for (let i = 0; i < Math.max(bloques.length, 1); i += 5) hojas.push(bloques.slice(i, i + 5))
  const periodo = d.desde === d.hasta ? fechaPdf(d.desde) : `${fechaPdf(d.desde)} – ${fechaPdf(d.hasta)}`
  return (
    <Document>
      {hojas.map((grupo, i) => (
        <PaginaEstandar
          key={i}
          trio={false}
          titulo="REGISTRO DE TEMPERATURAS DEL CONSERVADOR"
          subtitulo={d.orgNombre}
          codigoFmt={codigoFmt}
          folio={periodo}
          emision={periodo}
          detalleCompacto={`${codigoFmt}  |  ${d.empresa}  |  ${periodo}`}
          camposDatos={[
            { icono: 'codigo', etiqueta: 'Formato', valor: codigoFmt },
            { etiqueta: 'Empresa', valor: d.empresa },
            { icono: 'calendario', etiqueta: 'Periodo', valor: periodo },
            { etiqueta: 'Hoja', valor: `${i + 1} de ${hojas.length}` },
          ]}
        >
          {grupo.length === 0
            ? <Text style={{ fontSize: 8, color: PC.textSub }}>Sin lecturas en el periodo.</Text>
            : grupo.map((b, j) => {
                const bloque = <BloqueFecha key={j} b={b} limites={d.limites} verif={d.verificaciones.find(v => v.fecha === b.fecha) ?? null} unidad={d.unidad} />
                // En la última hoja, el último bloque viaja con las instrucciones y las firmas: nunca quedan solas en una página.
                if (!(i === hojas.length - 1 && j === grupo.length - 1)) return bloque
                return (
                  <View key={j} wrap={false}>
                    {bloque}
                    <Instrucciones d={d} />
                  </View>
                )
              })}
          {grupo.length === 0 && i === hojas.length - 1 && <Instrucciones d={d} />}
        </PaginaEstandar>
      ))}
    </Document>
  )
}
