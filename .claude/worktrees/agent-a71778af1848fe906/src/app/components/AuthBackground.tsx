// Fondo compartido de carrusel + overlay para Login y Registro.
// Carrusel de 3 imágenes de campo agrícola con fade suave cada 5 s.
// Overlay azul de marca semitransparente para que el formulario sea legible.

import { useState, useEffect } from 'react'

const SLIDES = [
  'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1200&q=75',
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1200&q=75',
  'https://images.unsplash.com/photo-1500651230702-0e2d8a49d4e9?auto=format&fit=crop&w=1200&q=75',
]

interface AuthBackgroundProps {
  children: React.ReactNode
}

export function AuthBackground({ children }: AuthBackgroundProps) {
  const [active, setActive] = useState(0)

  // Precargar la primera imagen inmediatamente
  useEffect(() => {
    SLIDES.forEach((src) => {
      const img = new Image()
      img.src = src
    })
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      setActive((prev) => (prev + 1) % SLIDES.length)
    }, 5000)
    return () => clearInterval(t)
  }, [])

  return (
    // Fallback azul oscuro mientras cargan las imágenes
    <div className="relative min-h-screen" style={{ background: '#0D3A5C' }}>

      {/* Slides apilados: fade in/out por opacidad */}
      {SLIDES.map((src, i) => (
        <div
          key={src}
          aria-hidden="true"
          className="fixed inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${src})`,
            opacity: i === active ? 1 : 0,
            transition: 'opacity 1s ease-in-out',
            zIndex: 0,
          }}
        />
      ))}

      {/* Overlay azul de marca */}
      <div
        aria-hidden="true"
        className="fixed inset-0"
        style={{
          background: 'rgba(13, 90, 143, 0.58)',
          zIndex: 1,
        }}
      />

      {/* Contenido desplazable sobre el fondo fijo */}
      <div
        className="relative flex flex-col items-center justify-center min-h-screen p-6 py-12"
        style={{ zIndex: 2 }}
      >
        {children}
      </div>
    </div>
  )
}
