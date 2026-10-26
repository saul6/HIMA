import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { cn } from '@/app/components/ui/utils'
import { DUR, EASE_OUT } from '@/lib/motion'

const CLAMP: Record<number, string> = {
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
}

interface TextoRecortableProps {
  children: ReactNode
  /** Líneas visibles antes de "Ver más" (2 a 6). */
  lineas?: 2 | 3 | 4 | 5 | 6
  /** Clases del texto (tamaño, color, interlineado). */
  className?: string
}

/**
 * Texto largo de solo lectura: recorta a `lineas` y ofrece "Ver más" / "Ver menos" solo si el
 * texto realmente desborda. Respeta saltos de línea y limita el ancho de lectura. Sin animación
 * de altura. No usar en el texto de la pregunta ni dentro de campos editables.
 */
export function TextoRecortable({ children, lineas = 3, className }: TextoRecortableProps) {
  const id = useId()
  const ref = useRef<HTMLParagraphElement>(null)
  const [abierto, setAbierto] = useState(false)
  const [desborda, setDesborda] = useState(false)
  const reducedMotion = useReducedMotion()
  const abiertoPrevio = useRef(abierto)

  // Fundido del texto al expandir o recoger (solo opacity; la altura cambia sin animar).
  useEffect(() => {
    if (abiertoPrevio.current === abierto) return
    abiertoPrevio.current = abierto
    if (reducedMotion || !ref.current) return
    animate(ref.current, { opacity: [0.4, 1] }, { duration: DUR.rapido, ease: EASE_OUT })
  }, [abierto, reducedMotion])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Abierto no hay recorte que medir: se conserva el último resultado.
    if (abierto) return
    const medir = () => setDesborda(el.scrollHeight > el.clientHeight + 1)
    medir()
    // Oculto mide 0: al desplegarse el bloque o cambiar el ancho, vuelve a medir.
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [abierto, children, lineas])

  return (
    <div className="max-w-[72ch]">
      <p
        ref={ref}
        id={id}
        className={cn('whitespace-pre-line break-words', !abierto && CLAMP[lineas], className)}
      >
        {children}
      </p>
      {(desborda || abierto) && (
        <button
          type="button"
          onClick={() => setAbierto(v => !v)}
          aria-expanded={abierto}
          aria-controls={id}
          className="inline-flex items-center min-h-11 px-1 -mx-1 text-small font-semibold text-primary rounded outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {abierto ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  )
}
