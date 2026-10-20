// Estado del carrusel de fotos de las pantallas de auth (escritorio y móvil).
// Precarga la primera foto antes que el resto y solo rota entre fotos ya
// cargadas, así nunca se muestra la capa oscura sola sobre un fondo vacío.
// Solo mantiene montadas la foto que entra y la que sale (`prev`).

import { useCallback, useEffect, useRef, useState } from 'react'

export function useAuthSlides(
  srcs: string[],
  intervalMs: number,
  paused = false,
  srcSets?: string[],
  sizes?: string,
) {
  const [active, setActive] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const [loaded, setLoaded] = useState<Set<number>>(new Set())
  const [reducedMotion, setReducedMotion] = useState(false)
  // Cuenta cada vez que arranca un intervalo de rotación: la píldora de
  // progreso la usa de `key` para reiniciar su relleno junto con el temporizador.
  const [ciclo, setCiclo] = useState(0)
  const prevTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // La primera foto se pide sola; las demás arrancan cuando ella ya cargó.
  useEffect(() => {
    let cancelled = false
    const marcar = (idx: number) => {
      if (!cancelled) setLoaded((p) => (p.has(idx) ? p : new Set(p).add(idx)))
    }
    const cargar = (idx: number) => {
      const img = new Image()
      img.onload = () => marcar(idx)
      // Mismo srcset/sizes que la <img> para precargar el archivo que se va a mostrar.
      if (srcSets) { img.sizes = sizes ?? '100vw'; img.srcset = srcSets[idx] }
      img.src = srcs[idx]
      return img
    }
    const primera = cargar(0)
    const resto = () => srcs.forEach((_, i) => { if (i > 0) cargar(i) })
    primera.onload = () => { marcar(0); resto() }
    primera.onerror = resto
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeRef = useRef(0)
  const irA = useCallback((next: number) => {
    const cur = activeRef.current
    if (cur === next) return
    activeRef.current = next
    setPrev(cur)
    setActive(next)
    if (prevTimer.current) clearTimeout(prevTimer.current)
    prevTimer.current = setTimeout(() => setPrev(null), 1700)
  }, [])

  useEffect(() => () => { if (prevTimer.current) clearTimeout(prevTimer.current) }, [])

  useEffect(() => {
    if (reducedMotion || paused) { setCiclo(0); return }
    if (srcs.filter((_, i) => loaded.has(i)).length > 1) setCiclo(c => c + 1)
    const t = setInterval(() => {
      const valid = srcs.map((_, i) => i).filter((i) => loaded.has(i))
      if (valid.length <= 1) return
      const pos = valid.indexOf(active)
      irA(valid[(pos + 1) % valid.length])
    }, intervalMs)
    return () => clearInterval(t)
  }, [reducedMotion, paused, loaded, active, irA, intervalMs, srcs])

  return { active, prev, loaded, reducedMotion, irA, ciclo }
}
