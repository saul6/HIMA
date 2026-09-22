// Banner superior para las pantallas de auth en MÓVIL (Opción B): foto del
// carrusel rotando lento + logo + título, fundiéndose con el panel verde
// oscuro de abajo. Solo se usa en el layout móvil (lg:hidden en el screen que
// lo monta) — reutiliza las mismas 6 imágenes y tokens que el panel de
// escritorio, nunca hex sueltos. Respeta prefers-reduced-motion y puede
// pausarse mientras el usuario escribe en un input (prop `paused`).

import { useState, useEffect } from 'react'
import { MadyLogo } from '@/app/components/MadyLogo'

const SLIDES = [
  { src: '/images/campo.jpg', area: 'Campo' },
  { src: '/images/invernadero.jpeg', area: 'Invernadero' },
  { src: '/images/empacadora.jpeg', area: 'Empacadora' },
  { src: '/images/cuartofrio.jpg', area: 'Cuarto frío' },
  { src: '/images/almacen.jpg', area: 'Almacén' },
  { src: '/images/carnicos.jpg', area: 'Cárnicos' },
]

interface AuthMobileBannerProps {
  paused?: boolean
}

export function AuthMobileBanner({ paused = false }: AuthMobileBannerProps) {
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
    SLIDES.forEach(({ src }, idx) => {
      const img = new Image()
      img.src = src
      img.onerror = () => setErroredSlides((prev) => new Set([...prev, idx]))
    })
  }, [])

  useEffect(() => {
    if (reducedMotion || paused) return
    const valid = SLIDES.map((_, i) => i).filter((i) => !erroredSlides.has(i))
    if (valid.length <= 1) return
    // Rotación lenta a propósito — más pausada que el panel de escritorio.
    const t = setInterval(() => {
      setActive((prev) => {
        const pos = valid.indexOf(prev)
        return valid[(pos + 1) % valid.length]
      })
    }, 7000)
    return () => clearInterval(t)
  }, [reducedMotion, paused, erroredSlides])

  const currentArea = SLIDES[active]?.area ?? ''

  return (
    <div className="relative w-full h-52 overflow-hidden" style={{ background: 'var(--auth-panel-dark)' }}>
      {SLIDES.map((slide, i) => (
        <div
          key={slide.src}
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${slide.src})`,
            opacity: i === active && !erroredSlides.has(i) ? 1 : 0,
            transition: reducedMotion ? 'none' : 'opacity 1.4s ease-in-out',
          }}
        />
      ))}

      {/* Misma capa que escritorio + degradado que funde el banner con el panel de abajo */}
      <div aria-hidden="true" className="absolute inset-0" style={{ background: 'var(--auth-carousel-overlay)' }} />
      <div aria-hidden="true" className="absolute inset-0" style={{ background: 'var(--auth-mobile-banner-fade)' }} />

      <div className="relative flex flex-col justify-between h-full p-4 pb-3 z-10">
        <MadyLogo theme="dark" style={{ height: 40, width: 'auto' }} />

        <div>
          <h2 className="text-white text-[19px] font-bold leading-[1.15] [letter-spacing:0.02em]">
            <span className="block uppercase">INOCUIDAD</span>
            <span className="block uppercase" style={{ color: 'var(--secondary)' }}>INTELIGENTE</span>
          </h2>
          <p
            key={currentArea}
            className="text-[11px] mt-1"
            style={{ color: 'rgba(255,255,255,0.65)', transition: reducedMotion ? 'none' : 'opacity 0.5s ease-in-out' }}
          >
            {currentArea}
          </p>
        </div>
      </div>
    </div>
  )
}
