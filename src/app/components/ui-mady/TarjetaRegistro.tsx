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

// Franja izquierda (solo en 2 columnas); siempre va acompañada del texto del estado.
const FRANJA: Record<EstadoTarjeta, string> = {
  firmado: 'border-l-[var(--agro-menta)]',
  pendiente: 'border-l-[var(--agro-info-text)]',
  correccion: 'border-l-[var(--agro-danger-text)]',
  neutro: 'border-l-[var(--border)]',
}

interface TarjetaRegistroProps {
  /** Franja de color + etiqueta de texto: solo habla de firmas (y de corrección). Solo en 2 columnas. */
  estado?: EstadoTarjeta
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
  /** Cuerpo propio del módulo, a ancho completo bajo el encabezado. */
  children?: React.ReactNode
  /** Bloque de firmas (FirmasRegistro), al fondo. */
  pie?: React.ReactNode
  className?: string
}

/** Tarjeta de registro de módulo. En 1 columna se ve como la tarjeta de siempre (p-4, borde, radio);
 * en 2 columnas (dentro de ListaTarjetas) suma franja y etiqueta de estado, chip de firmas y encabezado compacto. */
export function TarjetaRegistro({
  estado = 'neutro', meta, titulo, tituloTexto, tituloClassName, chips, chipMovil, firmas, responsable, acciones, children, pie, className,
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
        'min-w-0 rounded-xl border border-border bg-card p-4',
        dos && 'border-l-4',
        dos && FRANJA[estado],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
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
          {(chips || chipMovil || (dos && (textoEstado || firmas || responsable))) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {dos && textoEstado && <Etiqueta tono={TONO_ESTADO[estado]}>{textoEstado}</Etiqueta>}
              {dos && firmas && <Etiqueta tono="neutral" className="font-normal">{firmas.hechas}/{firmas.total} firmas</Etiqueta>}
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
        </div>
        {acciones && <div className="flex flex-shrink-0 items-center gap-1">{acciones}</div>}
      </div>
      {children}
      {pie}
    </div>
  )
}
