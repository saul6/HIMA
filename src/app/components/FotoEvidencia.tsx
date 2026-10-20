import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useReducedMotion } from 'motion/react'
import { cn } from '@/app/components/ui/utils'

interface FotoEvidenciaProps {
  src: string
  alt: string
  className?: string
  style?: CSSProperties
  /** Proporción del contenedor (ej. "4 / 3") cuando se conoce la de la foto. Si no, el contenedor
   * conserva el tamaño que ya traían las clases (w-14 h-14, w-full h-full…). */
  aspecto?: string
}

// Clases que describen la caja (tamaño, borde, radio, márgenes): van al contenedor.
// El resto (object-cover, filtros…) se queda en la <img>.
const CLASE_DE_CAJA = /^(?:(?:min-|max-)?[wh]-|size-|aspect-|flex-shrink|shrink|grow|flex-1|rounded|border|m[trblxy]?-|-m|self-|order-|col-|row-)/

/** `<img>` de evidencia con espacio reservado (fondo `bg-muted`) y fade de 150 ms al cargar.
 * Reutilizado donde ya existe una miniatura de foto (incidencias, accidentes, acciones
 * correctivas, agenda). Si la imagen ya está en caché (`complete` true al montar), se muestra
 * directo sin esperar el evento `onLoad`. Las vistas previas locales (`blob:`) se ven igual. */
export function FotoEvidencia({ src, alt, className, style, aspecto }: FotoEvidenciaProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    setLoaded(imgRef.current?.complete ?? false)
  }, [src])

  const clases = (className ?? '').split(/\s+/).filter(Boolean)
  const caja = clases.filter(c => CLASE_DE_CAJA.test(c))
  const imagen = clases.filter(c => !CLASE_DE_CAJA.test(c))

  return (
    <span
      className={cn('block overflow-hidden bg-muted', caja)}
      style={aspecto ? { aspectRatio: aspecto, ...style } : style}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn('block w-full h-full', imagen)}
        style={{
          opacity: reducedMotion || loaded ? 1 : 0,
          transition: reducedMotion ? 'none' : 'opacity var(--motion-fast) var(--ease-out)',
        }}
        onLoad={() => setLoaded(true)}
      />
    </span>
  )
}
