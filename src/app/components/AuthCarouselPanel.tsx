// Panel de carrusel compartido para las pantallas de auth (Login, Registro,
// RestablecerContrasena) en escritorio. Respeta prefers-reduced-motion.
// Solo se usa en el split de escritorio — no afecta la vista móvil.
// El bloque de título/subtítulo es FIJO (no cambia entre fotos); cada foto
// rota detrás con un caption discreto de su área abajo, y Ken Burns + crossfade.

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

interface AuthCarouselPanelProps {
  className?: string
}

export function AuthCarouselPanel({ className = '' }: AuthCarouselPanelProps) {
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
    if (reducedMotion) return
    const valid = SLIDES.map((_, i) => i).filter((i) => !erroredSlides.has(i))
    if (valid.length <= 1) return
    const t = setInterval(() => {
      setActive((prev) => {
        const pos = valid.indexOf(prev)
        return valid[(pos + 1) % valid.length]
      })
    }, 4500)
    return () => clearInterval(t)
  }, [reducedMotion, erroredSlides])

  return (
    <div
      className={`relative flex-col overflow-hidden ${className}`}
      style={{
        background: 'var(--auth-panel-dark)',
        borderRight: 'var(--auth-divider-width) solid var(--auth-divider)',
        boxShadow: `var(--auth-divider-glow)`,
      }}
    >
      {SLIDES.map((slide, i) => (
        <div
          key={slide.src}
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${slide.src})`,
            opacity: i === active && !erroredSlides.has(i) ? 1 : 0,
            transform: reducedMotion ? 'none' : (i === active ? 'scale(1.035)' : 'scale(1)'),
            transition: reducedMotion
              ? 'none'
              : 'opacity 1.4s ease-in-out, transform 4.5s ease-out',
          }}
        />
      ))}

      {/* Capa general (derivada del verde de marca) + scrim difuminado detrás
          del logo — ambas por token, se funden sin verse como "parche". */}
      <div aria-hidden="true" className="absolute inset-0" style={{ background: 'var(--auth-carousel-overlay)' }} />
      <div aria-hidden="true" className="absolute inset-0" style={{ background: 'var(--auth-logo-scrim)' }} />

      <div className="relative flex flex-col h-full p-10 xl:p-12 z-10">
        <div style={{ marginTop: -6, marginLeft: -4 }}>
          <MadyLogo theme="dark" style={{ height: 58, width: 'auto' }} />
        </div>

        {/* Bloque fijo — título + un subtítulo, no cambia entre fotos. */}
        <div className="mt-24 xl:mt-28" style={{ maxWidth: 440 }}>
          <h2 className="text-white text-[38px] xl:text-[42px] font-bold leading-[1.08] [letter-spacing:0.02em]">
            <span className="block uppercase">INOCUIDAD</span>
            <span className="block uppercase" style={{ color: 'var(--secondary)' }}>INTELIGENTE</span>
          </h2>
          <p className="mt-3 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Tecnología para una operación agrícola más segura.
          </p>
        </div>

        <div className="flex-1" />

        {/* Caption discreto del área + dots — abajo, crossfade real al cambiar de foto */}
        <div className="pb-5">
          <div className="relative mb-3" style={{ height: '1.1rem' }}>
            {SLIDES.map((slide, i) => (
              <p
                key={slide.area}
                className="absolute inset-x-0 top-0 text-xs"
                style={{
                  color: 'rgba(255,255,255,0.7)',
                  opacity: i === active ? 1 : 0,
                  transition: reducedMotion ? 'none' : 'opacity 0.6s ease-in-out',
                }}
              >
                {slide.area}
              </p>
            ))}
          </div>
          <div className="flex items-center gap-[6px]">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setActive(i)}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: i === active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.35)',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: reducedMotion ? 'none' : 'background 0.3s ease',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
