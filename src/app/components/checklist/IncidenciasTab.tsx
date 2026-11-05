import { useState } from 'react'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { Pildora } from './Pildora'
import { motion, useReducedMotion } from 'motion/react'
import { entrada, useEntradaPantalla } from '@/lib/motion'
import { fundidoEntrada } from '@/app/screens/auditor/motionAuditor'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { ListaTarjetas } from '@/app/components/ui-mady/ListaTarjetas'
import { TarjetaRegistro } from '@/app/components/ui-mady/TarjetaRegistro'
import { chk, useCarga, type IncidenciaLista, type Seguimiento } from '@/hooks/useChecklistV2'
import { Chip, ErrorReintentar, TONOS } from './comun'
import { fechaCorta, fechaLarga } from './constantes'

export const ETIQUETA_SEGUIMIENTO: Record<string, string> = {
  seguimiento: 'Seguimiento',
  correccion_reportada: 'Corrección reportada por el cliente',
  correccion_rechazada: 'Corrección rechazada',
  cierre: 'Cierre',
}

export function etiquetaEstadoIncidencia(estado: string): { label: string; tono: typeof TONOS.exito } {
  if (estado === 'cerrada') return { label: 'Cerrada', tono: TONOS.exito }
  if (estado === 'correccion_reportada') return { label: 'Corrección reportada', tono: TONOS.info }
  if (estado === 'seguimiento') return { label: 'En seguimiento', tono: TONOS.info }
  return { label: 'Abierta', tono: TONOS.peligro }
}

export function SeguimientosLista({ items }: { items: Seguimiento[] }) {
  if (!items?.length) return null
  return (
    <ul className="space-y-1 border-l-2 border-border pl-3">
      {items.map((s, i) => (
        <li key={i} className="text-xs">
          <span className="font-semibold text-foreground">{ETIQUETA_SEGUIMIENTO[s.tipo] ?? s.tipo}</span>
          <span className="text-muted-foreground"> · {s.cliente ? 'Cliente' : (s.actor ?? 'Consultoría')} · {fechaCorta(s.fecha)}</span>
          {s.texto && <p className="text-muted-foreground">{s.texto}</p>}
        </li>
      ))}
    </ul>
  )
}

interface Props { instalacionId: string; version: number }

export function IncidenciasTab({ instalacionId, version }: Props) {
  const [soloAbiertas, setSoloAbiertas] = useState(true)
  const reducedMotion = useReducedMotion()
  const carga = useCarga<IncidenciaLista[]>(`${instalacionId}:${version}:${soloAbiertas}`, () => chk.incidencias(instalacionId, soloAbiertas))

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Pildora activa={soloAbiertas} onClick={() => setSoloAbiertas(true)}>Abiertas</Pildora>
        <Pildora activa={!soloAbiertas} onClick={() => setSoloAbiertas(false)}>Todas</Pildora>
      </div>
      <p className="text-xs text-muted-foreground">El seguimiento y el cierre se hacen dentro de una visita en curso.</p>
      {carga.loading && !carga.data ? <ListaSkeleton rejilla rows={2} onReintentar={carga.recargar} />
        : carga.error ? <ErrorReintentar mensaje={carga.error} onReintentar={carga.recargar} />
        : (carga.data ?? []).length === 0 ? <EstadoVacio titulo={soloAbiertas ? 'Sin incidencias abiertas' : 'Sin incidencias'} />
        : (
        <ListaTarjetas>
        {(carga.data ?? []).map((x, n) => {
          const e = etiquetaEstadoIncidencia(x.estado)
          return (
            <motion.div key={x.id} className="min-w-0" {...entrada(n, reducedMotion)}>
            <TarjetaRegistro
              sinFirmas
              titulo={x.documento}
              tituloTexto={x.documento}
              contenido={<p className="text-xs text-muted-foreground">{[x.codigo, x.area].filter(Boolean).join(' · ')}</p>}
              acciones={<Chip tono={e.tono}>{e.label}</Chip>}
            >
              <div className="mt-2 space-y-2">
              <p className="text-sm">{x.descripcion}</p>
              <p className="text-xs text-muted-foreground">
                {x.origen_fecha ? `Detectada el ${fechaLarga(x.origen_fecha)}` : ''}
                {x.responsable ? ` · Responsable: ${x.responsable}` : ''}
                {x.fecha_compromiso ? ` · Compromiso: ${fechaLarga(x.fecha_compromiso)}` : ''}
              </p>
              <SeguimientosLista items={x.seguimientos} />
              </div>
            </TarjetaRegistro>
            </motion.div>
          )
        })}
        </ListaTarjetas>
        )}
    </div>
  )
}
