// Fondo de pantalla completa para las pantallas de auth en MÓVIL (v2):
// carrusel de fotos fijo (position: fixed) detrás de todo, con el logo
// M.A.D.Y anclado arriba-izquierda — sin eslogan, ese título grande queda
// solo en escritorio (ver AuthCarouselPanel.tsx). El formulario flota encima
// en una tarjeta "glass" (ver clase .auth-panel en el screen que la monta).
// Reutiliza las mismas 6 imágenes y tokens que el panel de escritorio. Solo
// se usa en el layout móvil (lg:hidden en el screen que lo monta). Respeta
// prefers-reduced-motion y puede pausarse mientras el usuario escribe en un
// input (prop `paused`).

import { useState, useEffect } from 'react'
import { MadyLogo } from '@/app/components/MadyLogo'

const SLIDES = [
  '/images/campo.jpg',
  '/images/invernadero.jpeg',
  '/images/empacadora.jpeg',
  '/images/cuartofrio.jpg',
  '/images/almacen.jpg',
  '/images/carnicos.jpg',
]

interface AuthMobileBackdropProps {
  paused?: boolean
}

export function AuthMobileBackdrop({ paused = false }: AuthMobileBackdropProps) {
  const [active, setActive] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [erroredSlides, setErroredSlides] = useState<Set<number>>(new Set())

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    SLIDES.forEach((src, idx) => {
      const img = new Image()
      img.src = src
      img.onerror = () => setErroredSlides((prev) => new Set([...prev, idx]))
    })
  }, [])

  useEffect(() => {
    if (reducedMotion || paused) return
    const valid = SLIDES.map((_, i) => i).filter((i) => !erroredSlides.has(i))
    if (valid.length <= 1) return
    // Rotación lenta — es un fondo, no debe distraer del formulario.
    const t = setInterval(() => {
      setActive((prev) => {
        const pos = valid.indexOf(prev)
        return valid[(pos + 1) % valid.length]
      })
    }, 8000)
    return () => clearInterval(t)
  }, [reducedMotion, paused, erroredSlides])

  return (
    <div className="fixed inset-0 z-0 overflow-hidden" style={{ background: 'var(--auth-panel-dark)' }}>
      <div aria-hidden="true" className="absolute inset-0">
        {SLIDES.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${src})`,
              opacity: i === active && !erroredSlides.has(i) ? 1 : 0,
              transition: reducedMotion ? 'none' : 'opacity 1.6s ease-in-out',
            }}
          />
        ))}
        <div className="absolute inset-0" style={{ background: 'var(--auth-mobile-bg-overlay)' }} />
      </div>

      <div className="absolute top-5 left-5">
        <MadyLogo theme="dark" style={{ height: 34, width: 'auto' }} />
      </div>
    </div>
  )
}
