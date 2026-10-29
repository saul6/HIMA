import * as React from 'react'
import { cn } from '../ui/utils'

interface TextoColapsableProps {
  texto: string
  /** Renglones visibles antes de "Ver más". */
  lineas?: number
  className?: string
  style?: React.CSSProperties
}

/** Texto libre largo recortado a `lineas` renglones; si no cabe, aparece "Ver más" y expande solo este texto
 * (visual, sin consultas). Uso: <TextoColapsable texto={r.descripcion} className="text-xs text-muted-foreground" /> */
export function TextoColapsable({ texto, lineas = 3, className, style }: TextoColapsableProps) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [abierto, setAbierto] = React.useState(false)
  const [desborda, setDesborda] = React.useState(false)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el || abierto) return
    const medir = () => setDesborda(el.scrollHeight > el.clientHeight + 1)
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [texto, lineas, abierto])

  return (
    <span className="block min-w-0">
      <span
        ref={ref}
        className={cn('block whitespace-pre-line break-words', className)}
        style={
          abierto
            ? style
            : { ...style, display: '-webkit-box', WebkitLineClamp: lineas, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
        }
      >
        {texto}
      </span>
      {(desborda || abierto) && (
        <button
          type="button"
          aria-expanded={abierto}
          onClick={() => setAbierto((v) => !v)}
          className="mt-0.5 rounded-sm text-xs font-semibold text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {abierto ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </span>
  )
}
