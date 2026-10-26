import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle, Circle, Minus, XCircle, Link2, AlertTriangle, ClipboardList,
} from 'lucide-react'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { comportamientoScroll } from './motionAuditor'
import { usePreguntaActiva } from './usePreguntaActiva'

// Navegador de preguntas compartido (Jornada y Ejecución). Es puramente visual:
// no consulta ni guarda nada; solo pinta lo que recibe y avisa con `onIr`.

// Estado de respuesta de los puntos del navegador: color + ícono + nombre,
// para que el estado no dependa solo del color.
export interface EstadoDestino { nombre: string; Icono: typeof Circle; color: string }

export const ESTADOS_LEYENDA: EstadoDestino[] = [
  { nombre: 'Cumple', Icono: CheckCircle, color: 'var(--agro-success-text)' },
  { nombre: 'Deficiencia', Icono: AlertTriangle, color: 'var(--agro-info-text)' },
  { nombre: 'No conformidad', Icono: XCircle, color: 'var(--agro-danger-text)' },
  { nombre: 'No aplica', Icono: Minus, color: 'var(--muted-foreground)' },
  { nombre: 'Por confirmar', Icono: Link2, color: 'var(--agro-menta)' },
  { nombre: 'Sin responder', Icono: Circle, color: 'var(--muted-foreground)' },
]

export function estadoDestino(resp: string | null, herencia: boolean): EstadoDestino {
  if (herencia) return ESTADOS_LEYENDA[4]
  if (!resp) return ESTADOS_LEYENDA[5]
  if (resp === 'cumplimiento_total' || resp === 'excede_cumplimiento') return ESTADOS_LEYENDA[0]
  if (resp === 'na') return ESTADOS_LEYENDA[3]
  if (resp === 'no_conformidad') return ESTADOS_LEYENDA[2]
  if (resp === 'deficiencia_menor') return { ...ESTADOS_LEYENDA[1], nombre: 'Deficiencia menor' }
  if (resp === 'deficiencia_mayor') return { ...ESTADOS_LEYENDA[1], nombre: 'Deficiencia mayor' }
  return ESTADOS_LEYENDA[1]
}

export interface PuntoNavegador {
  id: string
  estado: EstadoDestino
  /** Nombre largo del punto (tooltip y lector de pantalla). */
  titulo?: string
}

export interface ItemNavegador {
  id: string
  codigo: string
  texto: string
  /** Estado de la pregunta; `null` = sin ícono de estado conocido (círculo tenue). */
  estado: EstadoDestino | null
  /** Un punto por destino, solo cuando hay más de uno. */
  puntos?: PuntoNavegador[]
  /** Texto al margen derecho (p. ej. "No aplica en esta operación"). */
  nota?: string
  /** Sin responder: la incluye el filtro "Pendientes" del navegador agrupado. */
  pendiente?: boolean
}

/** Leyenda de los íconos de estado (solo visual: cada punto ya trae su texto para lectores de pantalla). */
export function LeyendaEstados() {
  return (
    <p aria-hidden="true" className="px-4 pb-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-small text-muted-foreground">
      {ESTADOS_LEYENDA.map(e => (
        <span key={e.nombre} className="inline-flex items-center gap-1">
          <e.Icono size={10} style={{ color: e.color }} />
          {e.nombre}
        </span>
      ))}
    </p>
  )
}

export function FilaNavegador({ item, activa, onClick }: {
  item: ItemNavegador
  activa: boolean
  onClick: () => void
}) {
  const { estado, puntos, nota } = item
  return (
    <button
      onClick={onClick}
      data-nav-id={item.id}
      aria-current={activa ? 'step' : undefined}
      className="w-full text-left px-4 py-2.5 flex items-center gap-2.5 focus-visible:outline-offset-[-2px] transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]"
      style={{
        backgroundColor: activa ? 'var(--agro-success-fill)' : 'transparent',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Estado: ícono + color + nombre para lectores de pantalla */}
      {estado ? (
        <>
          <estado.Icono size={12} aria-hidden="true" className="flex-shrink-0" style={{ color: estado.color }} />
          <span className="sr-only">{estado.nombre}</span>
        </>
      ) : (
        <Circle size={12} aria-hidden="true" className="flex-shrink-0 opacity-40" style={{ color: 'var(--muted-foreground)' }} />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-caption font-mono flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
            {item.codigo}
          </span>
          <p className="text-xs truncate" style={{ color: 'var(--foreground)', lineHeight: 1.3 }}>
            {item.texto}
          </p>
        </div>
        {/* Puntos por destino */}
        {puntos && puntos.length > 1 && (
          <div className="flex gap-1 mt-0.5">
            {puntos.map(p => (
              <span key={p.id} className="inline-flex" title={p.titulo}>
                <p.estado.Icono size={10} aria-hidden="true" style={{ color: p.estado.color }} />
                <span className="sr-only">{p.titulo ? `${p.titulo}: ${p.estado.nombre}` : p.estado.nombre}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      {nota && (
        <span className="text-caption max-w-24 flex-shrink-0 text-right leading-tight" style={{ color: 'var(--muted-foreground)' }}>
          {nota}
        </span>
      )}
    </button>
  )
}

export function NavegadorPreguntas({ items, activaId, onIr, textoVacio = 'Sin preguntas con este filtro.' }: {
  items: ItemNavegador[]
  activaId: string | null
  onIr: (id: string) => void
  textoVacio?: string
}) {
  if (items.length === 0) {
    return <EstadoVacio icono={ClipboardList} titulo={textoVacio} />
  }
  return (
    <>
      {items.map(item => (
        <FilaNavegador
          key={item.id}
          item={item}
          activa={item.id === activaId}
          onClick={() => onIr(item.id)}
        />
      ))}
    </>
  )
}

// ── Navegador agrupado (Ejecución, escritorio) ───────────────────────────────
// Módulo → bloque → pregunta, con avance "X de Y". La pregunta activa sale de lo que se ve en pantalla
// (id `preg-<uuid>` de cada tarjeta) y se marca con `aria-current="step"`.

export interface BloqueNavegador {
  id: string
  codigo: string
  nombre: string
  respondidas: number
  total: number
  items: ItemNavegador[]
}

export interface ModuloNavegador {
  id: string
  nombre: string
  respondidas: number
  total: number
  bloques: BloqueNavegador[]
}

type FiltroNavegador = 'todas' | 'pendientes'

export function NavegadorAgrupado({ modulos, onIr, className }: {
  modulos: ModuloNavegador[]
  onIr: (id: string) => void
  className?: string
}) {
  const [filtro, setFiltro] = useState<FiltroNavegador>('todas')
  const navRef = useRef<HTMLElement>(null)

  const ids = useMemo(
    () => modulos.flatMap(m => m.bloques.flatMap(b => b.items.map(i => i.id))),
    [modulos],
  )
  const activaId = usePreguntaActiva(ids, navRef)

  // Mantiene visible la fila activa dentro del propio navegador (sin mover la página).
  useEffect(() => {
    const nav = navRef.current
    if (!nav || !activaId || nav.offsetParent === null) return
    const fila = nav.querySelector<HTMLElement>(`[data-nav-id="${activaId}"]`)
    if (!fila) return
    const n = nav.getBoundingClientRect()
    const f = fila.getBoundingClientRect()
    if (f.top >= n.top && f.bottom <= n.bottom) return
    nav.scrollTo({
      top: nav.scrollTop + (f.top - n.top) - (n.height - f.height) / 2,
      behavior: comportamientoScroll(),
    })
  }, [activaId])

  const visibles = modulos
    .map(m => ({
      ...m,
      bloques: m.bloques
        .map(b => ({ ...b, items: filtro === 'pendientes' ? b.items.filter(i => i.pendiente) : b.items }))
        .filter(b => b.items.length > 0),
    }))
    .filter(m => m.bloques.length > 0)

  return (
    <nav ref={navRef} aria-label="Preguntas de la auditoría" className={className}>
      <div className="px-4 pt-3 pb-2 flex gap-1.5">
        {(['todas', 'pendientes'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            aria-pressed={filtro === f}
            className="flex-shrink-0 text-small font-medium px-2 py-0.5 rounded relative before:absolute before:content-[''] before:-inset-y-3 before:-inset-x-1"
            style={{
              backgroundColor: filtro === f ? 'var(--foreground)' : 'var(--muted)',
              color: filtro === f ? 'var(--card)' : 'var(--muted-foreground)',
            }}
          >
            {f === 'todas' ? 'Todas' : 'Pendientes'}
          </button>
        ))}
      </div>
      <LeyendaEstados />
      <div className="border-t border-border">
        {visibles.length === 0 ? (
          <EstadoVacio icono={ClipboardList} titulo="Sin preguntas con este filtro." />
        ) : (
          visibles.map(m => (
            <section key={m.id} aria-label={m.nombre}>
              <div className="px-4 pt-3 pb-1">
                <TituloSeccion as="h2" className="mb-0">{m.nombre}</TituloSeccion>
                <p className="text-caption text-muted-foreground">{m.respondidas} de {m.total} respondidas</p>
              </div>
              {m.bloques.map(b => (
                <div key={b.id}>
                  <p className="px-4 pt-2 pb-1 text-caption text-muted-foreground bg-muted">
                    <span className="font-mono">{b.codigo}</span> · {b.nombre} · {b.respondidas} de {b.total}
                  </p>
                  {b.items.map(item => (
                    <FilaNavegador
                      key={item.id}
                      item={item}
                      activa={item.id === activaId}
                      onClick={() => onIr(item.id)}
                    />
                  ))}
                </div>
              ))}
            </section>
          ))
        )}
      </div>
    </nav>
  )
}
