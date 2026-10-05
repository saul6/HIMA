import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useReducedMotion } from 'motion/react'

interface FotoEvidenciaProps {
  src: string
  alt: string
  className?: string
  style?: CSSProperties
}

/** `<img>` de evidencia con fade-in al cargar — reutilizado donde ya existe
 * una miniatura de foto (incidencias, accidentes, acciones correctivas,
 * agenda). Si la imagen ya está en caché (`complete` true al montar), se
 * muestra directo sin esperar el evento `onLoad`. */
export function FotoEvidencia({ src, alt, className, style }: FotoEvidenciaProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    setLoaded(imgRef.current?.complete ?? false)
  }, [src])

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      className={className}
      style={{
        ...style,
        opacity: reducedMotion || loaded ? 1 : 0,
        transition: reducedMotion ? 'none' : 'opacity var(--motion-slow) var(--ease-out)',
      }}
      onLoad={() => setLoaded(true)}
    />
  )
}
