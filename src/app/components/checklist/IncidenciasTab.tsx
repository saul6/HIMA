import { useState } from 'react'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { Pildora } from './Pildora'
import { chk, useCarga, type IncidenciaLista, type Seguimiento } from '@/hooks/useChecklistV2'
import { Cargando, Chip, ErrorReintentar, TONOS } from './comun'
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
  const carga = useCarga<IncidenciaLista[]>(`${instalacionId}:${version}:${soloAbiertas}`, () => chk.incidencias(instalacionId, soloAbiertas))

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Pildora activa={soloAbiertas} onClick={() => setSoloAbiertas(true)}>Abiertas</Pildora>
        <Pildora activa={!soloAbiertas} onClick={() => setSoloAbiertas(false)}>Todas</Pildora>
      </div>
      <p className="text-xs text-muted-foreground">El seguimiento y el cierre se hacen dentro de una visita en curso.</p>
      {carga.loading && !carga.data ? <Cargando />
        : carga.error ? <ErrorReintentar mensaje={carga.error} onReintentar={carga.recargar} />
        : (carga.data ?? []).length === 0 ? <EstadoVacio titulo={soloAbiertas ? 'Sin incidencias abiertas' : 'Sin incidencias'} />
        : (carga.data ?? []).map(x => {
          const e = etiquetaEstadoIncidencia(x.estado)
          return (
            <div key={x.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{x.documento}</p>
                  <p className="text-xs text-muted-foreground">{[x.codigo, x.area].filter(Boolean).join(' · ')}</p>
                </div>
                <Chip tono={e.tono}>{e.label}</Chip>
              </div>
              <p className="text-sm">{x.descripcion}</p>
              <p className="text-xs text-muted-foreground">
                {x.origen_fecha ? `Detectada el ${fechaLarga(x.origen_fecha)}` : ''}
                {x.responsable ? ` · Responsable: ${x.responsable}` : ''}
                {x.fecha_compromiso ? ` · Compromiso: ${fechaLarga(x.fecha_compromiso)}` : ''}
              </p>
              <SeguimientosLista items={x.seguimientos} />
            </div>
          )
        })}
    </div>
  )
}
