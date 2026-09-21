// Panel de carrusel compartido para las pantallas de auth (Login, Registro,
// RestablecerContrasena) en escritorio. Respeta prefers-reduced-motion.
// Solo se usa en el split de escritorio — no afecta la vista móvil.

import { useState, useEffect } from 'react'
import { MadyLogo } from '@/app/components/MadyLogo'

// Para usar imágenes locales: agrega archivos en public/images/ y pon la ruta aquí.
const SLIDES = [
  {
    src: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1400&q=80',
    caption: 'Inocuidad Inteligente, lista para auditoría PrimusGFS',
  },
  {
    src: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1400&q=80',
    caption: 'Trazabilidad completa del campo a la empacadora',
  },
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
    }, 3500)
    return () => clearInterval(t)
  }, [reducedMotion, erroredSlides])

  return (
    <div className={`relative flex-col overflow-hidden ${className}`} style={{ background: 'var(--auth-panel-dark)' }}>
      {SLIDES.map((slide, i) => (
        <div
          key={slide.src}
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${slide.src})`,
            opacity: i === active && !erroredSlides.has(i) ? 1 : 0,
            transition: reducedMotion ? 'none' : 'opacity 1s ease-in-out',
          }}
        />
      ))}

      {/* Capa sobria/neutra (negro translúcido) — más fuerte en la esquina
          inferior-izquierda para legibilidad del caption, se desvanece hacia
          el resto. No tiñe de verde para no alterar el color de las fotos. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'var(--auth-carousel-overlay)' }}
      />

      <div className="relative flex flex-col justify-between h-full p-10 z-10">
        <div>
          <MadyLogo theme="dark" style={{ height: 48, width: 'auto' }} />
        </div>

        <div className="pb-2">
          <div className="relative" style={{ minHeight: '5.5rem' }}>
            {SLIDES.map((slide, i) => (
              <p
                key={i}
                className="absolute inset-x-0 top-0 text-white text-xl font-semibold leading-snug"
                style={{
                  opacity: i === active ? 1 : 0,
                  transition: reducedMotion ? 'none' : 'opacity 0.6s ease-in-out',
                  maxWidth: 440,
                  pointerEvents: i === active ? 'auto' : 'none',
                }}
              >
                {slide.caption}
              </p>
            ))}
          </div>

          <div className="flex items-center gap-[6px] mt-4">
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
