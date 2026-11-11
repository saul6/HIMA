// PDF M85 — Registro de temperaturas del conservador (formato PRO-05): cinco bloques de fecha por hoja,
// columnas 01:00–24:00, renglones Temperatura y Realizó, y Observaciones. Si hacen falta más bloques, sigue otra hoja igual.
import { Document, View, Text } from '@react-pdf/renderer'
import { PaginaEstandar } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'
import { proyectarBloques, observacionesBloque, fmtF, type Bloque, type LecturaBase } from './conservadorLogica'

export interface M85DatosPDF {
  orgNombre: string
  empresa: string
  desde: string
  hasta: string
  limites: { min: number; max: number }
  lecturas: LecturaBase[]
}

const ANCHO = 841.89 - 80
const ETQ = 58
const COL = (ANCHO - ETQ) / 24
const borde = { borderColor: PC.border ?? '#C8CED6', borderWidth: 0.5 }

function Celda({ txt, ancho, negrita, color, fondo }: { txt: string; ancho: number; negrita?: boolean; color?: string; fondo?: string }) {
  return (
    <View style={{ width: ancho, height: 13, justifyContent: 'center', alignItems: 'center', ...borde, backgroundColor: fondo }}>
      <Text style={{ fontSize: 6.2, fontFamily: negrita ? 'Helvetica-Bold' : 'Helvetica', color: color ?? PC.fieldValue }}>{txt}</Text>
    </View>
  )
}

function BloqueFecha({ b, limites }: { b: Bloque; limites: { min: number; max: number } }) {
  const cols = Array.from({ length: 24 }, (_, i) => i + 1)
  const obs = observacionesBloque(b, limites)
  return (
    <View wrap={false} style={{ marginBottom: 7 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 }}>
        <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.fieldValue }}>Fecha: {fechaPdf(b.fecha)}</Text>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <Celda txt="Hora" ancho={ETQ} negrita fondo="#F2F4F7" />
        {cols.map(c => <Celda key={c} txt={`${String(c).padStart(2, '0')}:00`} ancho={COL} negrita fondo="#F2F4F7" />)}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <Celda txt="Temperatura" ancho={ETQ} negrita />
        {cols.map(c => {
          const l = b.celdas.get(c)
          const fuera = l ? l.temperatura_f < limites.min || l.temperatura_f > limites.max : false
          return <Celda key={c} txt={l ? fmtF(l.temperatura_f) : ''} ancho={COL} color={fuera ? PC.negativo : undefined} />
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
            : grupo.map((b, j) => <BloqueFecha key={j} b={b} limites={d.limites} />)}
          {i === hojas.length - 1 && (
            <View wrap={false}>
              <Text style={{ fontSize: 6.5, color: PC.textSub, marginTop: 4 }}>
                Instrucciones: Al iniciar el turno revisar la temperatura del conservador y registrarla en la hora correspondiente, posteriormente hacerlo
                cada dos horas durante la duración de la jornada laboral. Se debe especificar con las iniciales de la persona que realiza la actividad;
                en observaciones deben estar las iniciales con el nombre completo de quién realizó dicha actividad. Temperatura ambiente del conservador en °F;
                intervalo operativo {d.limites.min}–{d.limites.max} °F.
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 26 }}>
                {[`Responsable ${d.orgNombre}`, 'Responsable de la empresa'].map(t => (
                  <View key={t} style={{ width: 300 }}>
                    <View style={{ borderBottomWidth: 0.8, borderBottomColor: PC.fieldValue }} />
                    <Text style={{ fontSize: 7.5, color: PC.textSub, marginTop: 3 }}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </PaginaEstandar>
      ))}
    </Document>
  )
}
