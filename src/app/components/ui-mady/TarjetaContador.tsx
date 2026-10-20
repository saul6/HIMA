import * as React from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useContadorAnimado } from '@/hooks/useContadorAnimado'
import { SPRING_SUAVE } from '@/lib/motion'
import { cn } from '../ui/utils'

/** Color de la tarjeta. `info`/`alerta` pintan caja completa (borde + fondo + texto);
 * `alertaTexto` solo el texto en rojo; `destacado` pone el número en --primary
 * y un punto menta junto a la etiqueta. */
type TonoContador = 'normal' | 'info' | 'alerta' | 'alertaTexto' | 'destacado'

interface TarjetaContadorProps {
  etiqueta: string
  /** Número (se anima), `null` (muestra "—") o un nodo ya compuesto, p. ej. "3 de 8" (se muestra tal cual). */
  valor: number | null | React.ReactNode
  /** Formato del número animado; por defecto entero. */
  format?: (n: number) => string
  sub?: string
  tono?: TonoContador
  /** `seleccionable` es un button con aria-pressed. */
  variante?: 'normal' | 'seleccionable'
  /** Solo en `seleccionable`: estado activo (aria-pressed). */
  activo?: boolean
  /** Solo en `seleccionable`: si viene, el fondo activo se desliza entre tarjetas (layoutId compartido). */
  resaltadoId?: string
  /** Posición en la cuadrícula: activa la entrada escalonada (solo las primeras 8 con retraso). */
  indice?: number
  /** Número arriba y etiqueta debajo (compacta); por defecto etiqueta arriba. */
  valorPrimero?: boolean
  onClick?: () => void
  className?: string
}

const formatoEntero = (n: number) => String(Math.round(n))
const EASE = [0.22, 1, 0.36, 1] as const

const CAJA: Record<TonoContador, string> = {
  normal: 'border-border bg-card',
  destacado: 'border-border bg-card',
  alertaTexto: 'border-border bg-card',
  info: 'border-agro-menta bg-agro-info-fill',
  alerta: 'border-agro-red bg-agro-danger-fill',
}

/** Tarjeta con número animado y etiqueta. Sin sombra.
 * Uso: <TarjetaContador etiqueta="Vencidas" valor={3} tono="alerta" /> */
export function TarjetaContador({
  etiqueta, valor, format = formatoEntero, sub, tono = 'normal', variante = 'normal',
  activo = false, resaltadoId, indice, valorPrimero = false, onClick, className,
}: TarjetaContadorProps) {
  const reducedMotion = useReducedMotion() ?? false
  const esNumero = typeof valor === 'number'
  const spanRef = useContadorAnimado(esNumero ? valor : null, format, reducedMotion)
  const seleccionable = variante === 'seleccionable'
  const marcado = seleccionable && activo
  const destacado = tono === 'destacado'

  let colorNumero: string
  let colorEtiqueta: string
  if (tono === 'info') {
    colorNumero = colorEtiqueta = 'text-agro-info-text'
  } else if (tono === 'alerta') {
    colorNumero = colorEtiqueta = 'text-agro-danger-text'
  } else {
    colorNumero = destacado ? 'text-primary'
      : tono === 'alertaTexto' ? 'text-agro-danger-text'
      : marcado ? 'text-accent-foreground' : 'text-foreground'
    colorEtiqueta = marcado ? 'text-accent-foreground'
      : tono === 'alertaTexto' ? 'text-agro-danger-text' : 'text-muted-foreground'
  }

  const contenidoValor = esNumero ? <span ref={spanRef}>{format(valor)}</span>
    : valor === null ? '—'
    : valor

  const numero = (
    <span
      className={cn(
        'relative z-10 text-2xl tabular-nums',
        valorPrimero ? 'font-semibold tracking-tight' : 'font-bold',
        colorNumero,
      )}
    >
      {contenidoValor}
    </span>
  )
  const rotulo = (
    <span
      className={cn(
        'relative z-10 text-xs',
        valorPrimero && 'mt-0.5',
        valorPrimero && !destacado && 'leading-tight',
        destacado && 'flex items-center gap-1.5',
        colorEtiqueta,
      )}
    >
      {destacado && <span className="size-2 shrink-0 rounded-full bg-secondary" />}
      {etiqueta}
    </span>
  )

  const cuerpo = (
    <>
      {marcado && resaltadoId && (
        <motion.span
          layoutId={resaltadoId}
          className="absolute inset-0 rounded-xl bg-accent"
          style={{ zIndex: 0 }}
          transition={reducedMotion ? { duration: 0 } : SPRING_SUAVE}
        />
      )}
      {valorPrimero ? <>{numero}{rotulo}</> : <>{rotulo}{numero}</>}
      {sub && <span className="relative z-10 text-xs text-muted-foreground">{sub}</span>}
    </>
  )

  const clase = cn(
    'relative flex flex-col items-start rounded-xl border p-4 text-left',
    !valorPrimero && 'gap-1',
    seleccionable
      ? [
          'outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          marcado
            ? (resaltadoId ? 'border-transparent' : 'border-primary bg-muted')
            : 'border-border bg-card hover:bg-muted',
        ]
      : CAJA[tono],
    className,
  )

  const entrada = indice === undefined ? null : {
    initial: reducedMotion ? (false as const) : { opacity: 0, y: 8 },
    animate: {
      opacity: 1, y: 0,
      transition: { duration: 0.22, ease: EASE, delay: Math.min(indice, 7) * 0.03 },
    },
  }

  if (seleccionable) {
    const boton = (
      <button
        type="button"
        aria-pressed={activo}
        onClick={onClick}
        className={cn(clase, entrada && 'w-full')}
        style={{ transitionDuration: 'var(--motion-fast)' }}
      >
        {cuerpo}
      </button>
    )
    return entrada ? <motion.div {...entrada}>{boton}</motion.div> : boton
  }
  return entrada
    ? <motion.div {...entrada} className={clase}>{cuerpo}</motion.div>
    : <div className={clase}>{cuerpo}</div>
}
