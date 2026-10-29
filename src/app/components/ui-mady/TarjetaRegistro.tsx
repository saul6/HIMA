import * as React from 'react'
import { cn } from '../ui/utils'
import { Etiqueta, type TonoEtiqueta } from './Etiqueta'
import { useListaDosColumnas } from './ListaTarjetas'

export type EstadoTarjeta = 'firmado' | 'pendiente' | 'correccion' | 'neutro'

const TEXTO_ESTADO: Record<EstadoTarjeta, string | null> = {
  firmado: 'Firmado',
  pendiente: 'Pendiente de firma',
  correccion: 'Requiere corrección',
  neutro: null,
}

const TONO_ESTADO: Record<EstadoTarjeta, TonoEtiqueta> = {
  firmado: 'menta',
  pendiente: 'pendiente',
  correccion: 'error',
  neutro: 'neutral',
}

// Franja de estado (solo en 2 columnas): 2 px, dentro de la tarjeta y sin tocar las esquinas, con el color
// del token atenuado (claro y oscuro). Siempre va acompañada del texto del estado.
const FRANJA: Record<EstadoTarjeta, string> = {
  firmado: 'bg-agro-menta/60',
  pendiente: 'bg-agro-info-text/50',
  correccion: 'bg-agro-danger-text/60',
  neutro: 'bg-border',
}

interface TarjetaRegistroProps {
  /** Franja de color + etiqueta de texto: solo habla de firmas (y de corrección). Solo en 2 columnas. */
  estado?: EstadoTarjeta
  /** Etiquetas del módulo (prioridad...). En 1 columna van sobre las líneas `meta` (como en la tarjeta anterior);
   * en 2 columnas pasan a la fila de chips. */
  etiquetas?: React.ReactNode
  /** Líneas pequeñas sobre el título (instalación, fecha). En 1 columna una por renglón; en 2 columnas en una línea con " · ". */
  meta?: React.ReactNode[]
  titulo?: React.ReactNode
  /** Texto plano del título para `title` (máx. 2 renglones). */
  tituloTexto?: string
  /** Ajuste fino del título para que en 1 columna coincida con la tarjeta anterior del módulo. */
  tituloClassName?: string
  /** Chips propios del módulo (resultado, prioridad...). */
  chips?: React.ReactNode
  /** Chip antiguo del módulo ("Pendiente de firma"): solo se ve en 1 columna; en 2 columnas lo cubre `estado`. */
  chipMovil?: React.ReactNode
  /** Chip "N/M firmas" (solo 2 columnas). */
  firmas?: { hechas: number; total: number } | null
  responsable?: React.ReactNode
  /** Botones de arriba a la derecha (PDF, eliminar...). */
  acciones?: React.ReactNode
  /** Aviso sobre el encabezado (p. ej. el comentario de corrección). */
  encima?: React.ReactNode
  /** Hace clicable la columna del título (con teclado y foco): para tarjetas que se expanden. */
  alHacerClic?: () => void
  /** aria-expanded de la zona clicable. */
  expandido?: boolean
  /** Contenido propio en la columna del título (textos, chips, fotos), a la izquierda de `acciones`. */
  contenido?: React.ReactNode
  /** Cuerpo propio del módulo, a ancho completo bajo el encabezado. */
  children?: React.ReactNode
  /** Bloque de firmas (FirmasRegistro), al fondo. */
  pie?: React.ReactNode
  className?: string
}

/** Tarjeta de registro de módulo. En 1 columna se ve como la tarjeta de siempre (p-4, borde, radio);
 * en 2 columnas (dentro de ListaTarjetas) suma franja y etiqueta de estado, chip de firmas y encabezado compacto. */
export function TarjetaRegistro({
  estado = 'neutro', etiquetas, meta, titulo, tituloTexto, tituloClassName, chips, chipMovil, firmas, responsable, contenido, acciones, children, pie, encima, alHacerClic, expandido, className,
}: TarjetaRegistroProps) {
  const dos = useListaDosColumnas()
  const textoEstado = TEXTO_ESTADO[estado]
  const lineas = (meta ?? []).filter(Boolean)

  const tituloEl = titulo ? (
    <p
      className={cn('font-semibold text-foreground', dos ? 'text-base leading-snug' : 'text-sm', tituloClassName)}
      title={tituloTexto}
      style={dos ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}
    >
      {titulo}
    </p>
  ) : null

  return (
    <div
      className={cn(
        'relative min-w-0 rounded-xl border border-border bg-card p-4',
        // En 1 columna, "requiere corrección" conserva el aspecto de siempre: borde menta y fondo de aviso.
        !dos && estado === 'correccion' && 'border-[var(--agro-menta)] bg-[var(--agro-info-fill)]',
        className,
      )}
    >
      {dos && <span aria-hidden="true" className={cn('pointer-events-none absolute bottom-3 left-1.5 top-3 w-0.5 rounded-full', FRANJA[estado])} />}
      {encima}
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn('min-w-0 flex-1', alHacerClic && 'cursor-pointer rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50')}
          {...(alHacerClic
            ? {
                role: 'button' as const,
                tabIndex: 0,
                'aria-expanded': expandido,
                onClick: alHacerClic,
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    alHacerClic()
                  }
                },
              }
            : {})}
        >
          {!dos && etiquetas && <div className="mb-1 flex flex-wrap items-center gap-2">{etiquetas}</div>}
          {dos ? (
            lineas.length > 0 && (
              <p className="mb-0.5 text-xs text-muted-foreground">
                {lineas.map((l, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && ' · '}
                    {l}
                  </React.Fragment>
                ))}
              </p>
            )
          ) : (
            lineas.map((l, i) => (
              <p key={i} className="text-xs text-muted-foreground">{l}</p>
            ))
          )}
          {tituloEl}
          {(chips || chipMovil || (dos && (textoEstado || firmas || responsable || etiquetas))) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {dos && textoEstado && <Etiqueta tono={TONO_ESTADO[estado]}>{textoEstado}</Etiqueta>}
              {dos && firmas && <Etiqueta tono="neutral" className="font-normal">{firmas.hechas}/{firmas.total} firmas</Etiqueta>}
              {dos && etiquetas}
              {chips}
              {!dos && chipMovil}
              {dos && responsable && (
                <span className="min-w-0 break-words text-xs text-muted-foreground">
                  Responsable: <span className="font-semibold text-foreground">{responsable}</span>
                </span>
              )}
            </div>
          )}
          {!dos && responsable && <p className="mt-1 text-xs text-muted-foreground">{responsable}</p>}
          {contenido}
        </div>
        {acciones && <div className="flex flex-shrink-0 items-center gap-1">{acciones}</div>}
      </div>
      {children}
      {pie}
    </div>
  )
}
