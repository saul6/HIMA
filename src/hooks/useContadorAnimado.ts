import { useEffect, useRef } from 'react'
import { animate } from 'motion'

const DURACION_CONTADOR_S = 1.1

/** Contador animado compartido (extraído de Home.tsx `AnimatedNumber`): en
 * cada montaje cuenta desde 0; si `value` cambia con el componente ya
 * montado, anima del valor anterior al nuevo en vez de saltar directo.
 * `format` decide el texto exacto. Si `value` es null no anima — el
 * consumidor pinta su propio fallback. Devuelve el ref a poner en el `span`
 * que va a mostrar el número (la escritura es directa a `textContent` por
 * rendimiento, igual que en Home). */
export function useContadorAnimado(
  value: number | null,
  format: (n: number) => string,
  reducedMotion: boolean,
) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const prevValorRef = useRef<number | null>(null)

  useEffect(() => {
    const node = spanRef.current
    if (!node || value === null) return
    const anterior = prevValorRef.current
    if (reducedMotion || anterior === value) {
      node.textContent = format(value)
      prevValorRef.current = value
      return
    }
    const desde = anterior ?? 0
    const controls = animate(desde, value, {
      duration: DURACION_CONTADOR_S,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        node.textContent = format(latest)
      },
    })
    prevValorRef.current = value
    return () => controls.stop()
  }, [value, reducedMotion, format])

  return spanRef
}
