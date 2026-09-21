// Panel de carrusel compartido para las pantallas de auth (Login, Registro,
// RestablecerContrasena) en escritorio. Respeta prefers-reduced-motion.
// Solo se usa en el split de escritorio — no afecta la vista móvil.
// El bloque de texto (titular, subtítulo, features, wordmark) es FIJO — solo
// las fotos de fondo rotan detrás de él.

import { useState, useEffect } from 'react'
import { Shield, Leaf, TrendingUp } from 'lucide-react'
import { MadyLogo } from '@/app/components/MadyLogo'

// Para usar imágenes locales: agrega archivos en public/images/ y pon la ruta aquí.
const SLIDES = [
  'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1400&q=80',
]

const FEATURES = [
  { icon: Shield, text: 'Productos más seguros' },
  { icon: Leaf, text: 'Cultivos más saludables' },
  { icon: TrendingUp, text: 'Decisiones más inteligentes' },
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
    SLIDES.forEach((src, idx) => {
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
    <div
      className={`relative flex-col overflow-hidden ${className}`}
      style={{ background: 'var(--auth-panel-dark)', borderRight: '1px solid var(--auth-divider)' }}
    >
      {SLIDES.map((src, i) => (
        <div
          key={src}
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${src})`,
            opacity: i === active && !erroredSlides.has(i) ? 1 : 0,
            transition: reducedMotion ? 'none' : 'opacity 1s ease-in-out',
          }}
        />
      ))}

      {/* Capa derivada del verde de marca (toque muy ligero, no negro puro) —
          más fuerte abajo-izquierda para legibilidad del bloque de texto. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'var(--auth-carousel-overlay)' }}
      />

      <div className="relative flex flex-col justify-between h-full p-10 xl:p-12 z-10">
        <div>
          <MadyLogo theme="dark" style={{ height: 56, width: 'auto' }} />
        </div>

        {/* Bloque fijo — no cambia entre fotos */}
        <div className="pb-2" style={{ maxWidth: 460 }}>
          <h2 className="text-white text-[32px] xl:text-[36px] font-bold leading-tight [letter-spacing:-0.01em]">
            Inocuidad <span style={{ color: 'var(--secondary)' }}>Inteligente</span>
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Tecnología y análisis para un campo más seguro y productivo.
          </p>

          <div className="flex flex-wrap gap-x-6 gap-y-3 mt-6">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2">
                <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--secondary)' }} />
                <span className="text-xs font-normal text-white">{text}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-[6px] mt-6">
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

          <p className="mt-5 text-[11px] tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
            M.A.D.Y · INOCUIDAD INTELIGENTE
          </p>
        </div>
      </div>
    </div>
  )
}
