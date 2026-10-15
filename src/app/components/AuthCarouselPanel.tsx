// Panel de carrusel compartido para las pantallas de auth (Login, Registro,
// RestablecerContrasena) en escritorio. Respeta prefers-reduced-motion.
// Solo se usa en escritorio (lg+) — no afecta la vista móvil. Se monta como
// fondo a pantalla completa (absolute inset-0) detrás de la tarjeta glass
// flotante del formulario, ver clase .auth-panel en cada screen.
// El bloque de título/subtítulo es FIJO (no cambia entre fotos); cada foto
// rota detrás con un caption discreto de su área abajo, y Ken Burns + crossfade.

import { MadyLogo } from '@/app/components/MadyLogo'
import { useAuthSlides } from '@/hooks/useAuthSlides'

const SLIDES = [
  { src: '/images/campo.jpg', area: 'Campo' },
  { src: '/images/invernadero.jpeg', area: 'Invernadero' },
  { src: '/images/empacadora.jpeg', area: 'Empacadora' },
  { src: '/images/cuartofrio.jpg', area: 'Cuarto frío' },
  { src: '/images/almacen.jpg', area: 'Almacén' },
  { src: '/images/carnicos.jpg', area: 'Cárnicos' },
]
const SLIDE_SRCS = SLIDES.map((s) => s.src)

interface AuthCarouselPanelProps {
  className?: string
}

export function AuthCarouselPanel({ className = '' }: AuthCarouselPanelProps) {
  const { active, prev, loaded, reducedMotion, irA } = useAuthSlides(SLIDE_SRCS, 4500)

  return (
    <div
      className={`relative flex-col overflow-hidden ${className}`}
      style={{ background: 'var(--auth-bg-base)' }}
    >
      {/* Fotos + capas aparecen JUNTAS con fade cuando la foto activa ya
          cargó: nunca la capa sola sobre el fondo vacío. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          opacity: loaded.has(active) ? 1 : 0,
          transition: reducedMotion ? 'none' : 'opacity var(--motion-slow) ease',
        }}
      >
        {[prev, active].map((i) =>
          i === null ? null : (
            <div
              key={SLIDES[i].src}
              className={`absolute inset-0 ${i === prev ? 'auth-slide-out' : prev !== null ? 'auth-slide-in' : ''}`}
            >
              <img
                src={SLIDES[i].src}
                alt=""
                decoding="async"
                fetchPriority={i === 0 ? 'high' : undefined}
                className="h-full w-full object-cover"
              />
            </div>
          ),
        )}

        {/* Capa general + scrim difuminado detrás del logo — por token. */}
        <div className="absolute inset-0" style={{ background: 'var(--auth-carousel-overlay)' }} />
        <div className="absolute inset-0" style={{ background: 'var(--auth-logo-scrim)' }} />
      </div>

      <div className="relative flex flex-col h-full p-10 xl:p-12 z-10">
        <div style={{ marginTop: -6, marginLeft: -4 }}>
          <MadyLogo theme="dark" style={{ height: 58, width: 'auto' }} />
        </div>

        {/* Bloque fijo — título + un subtítulo, no cambia entre fotos. */}
        <div className="mt-24 xl:mt-28" style={{ maxWidth: 440 }}>
          <h2 className="text-white text-[38px] xl:text-[42px] font-bold leading-[1.08] [letter-spacing:0.02em]">
            <span className="block uppercase">INOCUIDAD</span>
            <span className="block uppercase" style={{ color: 'var(--auth-accent)' }}>INTELIGENTE</span>
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
                onClick={() => { if (loaded.has(i)) irA(i) }}
                className="no-press"
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
