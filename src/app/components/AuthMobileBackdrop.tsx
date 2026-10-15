// Fondo de pantalla completa para las pantallas de auth en MÓVIL (v3):
// carrusel de fotos fijo (position: fixed) detrás de todo, con el logo
// M.A.D.Y anclado arriba-izquierda — sin eslogan, ese título grande queda
// solo en escritorio (ver AuthCarouselPanel.tsx). El formulario flota encima
// en una tarjeta "glass" (ver clase .auth-panel en el screen que la monta).
// Reutiliza las mismas 6 imágenes y tokens que el panel de escritorio. Solo
// se usa en el layout móvil (lg:hidden en el screen que lo monta). Respeta
// prefers-reduced-motion y puede pausarse mientras el usuario escribe en un
// input (prop `paused`).
//
// El logo se renderiza en su PROPIO elemento fixed con z-index mayor al de
// la tarjeta (.auth-panel usa z-10), como hermano del carrusel (z-0) en vez
// de vivir anidado dentro de él. Si estuviera anidado, ningún z-index interno
// podría hacerlo aparecer por encima de la tarjeta: el carrusel completo ya
// pinta por debajo de ella por tener z-index menor, así que un contenido
// alto de la tarjeta (ej. el estado "Correo enviado" de recuperar acceso) la
// taparía. Separado así, el logo queda siempre visible sin importar el alto
// de la tarjeta ni el ancho de pantalla.

import { MadyLogo } from '@/app/components/MadyLogo'
import { useAuthSlides } from '@/hooks/useAuthSlides'

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
  // Rotación lenta — es un fondo, no debe distraer del formulario.
  const { active, prev, loaded, reducedMotion } = useAuthSlides(SLIDES, 8000, paused)

  return (
    <>
      <div className="fixed inset-0 z-0 overflow-hidden" style={{ background: 'var(--auth-bg-base)' }}>
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
                key={SLIDES[i]}
                className={`absolute inset-0 ${i === prev ? 'auth-slide-out' : prev !== null ? 'auth-slide-in' : ''}`}
              >
                <img
                  src={SLIDES[i]}
                  alt=""
                  decoding="async"
                  fetchPriority={i === 0 ? 'high' : undefined}
                  className="h-full w-full object-cover"
                />
              </div>
            ),
          )}
          <div className="absolute inset-0" style={{ background: 'var(--auth-mobile-bg-overlay)' }} />
        </div>
      </div>

      {/* z-20: por encima de .auth-panel (z-10) siempre, sin importar cuánto
          crezca la tarjeta en pantallas bajas o con contenido largo. */}
      <div className="fixed top-5 left-5 z-20">
        <MadyLogo theme="dark" style={{ height: 34, width: 'auto' }} />
      </div>
    </>
  )
}
