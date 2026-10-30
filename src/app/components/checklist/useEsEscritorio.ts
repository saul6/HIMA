import { useEffect, useState } from 'react'

const CONSULTA = '(min-width: 1024px)' // breakpoint lg

/** true desde `lg`: la visita se muestra como lista + panel de revisión. */
export function useEsEscritorio(): boolean {
  const [es, setEs] = useState(() => (typeof window !== 'undefined' && !!window.matchMedia ? window.matchMedia(CONSULTA).matches : false))
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia(CONSULTA)
    const alCambiar = () => setEs(mq.matches)
    alCambiar()
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [])
  return es
}
