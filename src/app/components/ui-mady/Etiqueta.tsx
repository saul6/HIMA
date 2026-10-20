import * as React from 'react'
import { cn } from '../ui/utils'

export type TonoEtiqueta = 'neutral' | 'menta' | 'rojo' | 'sky' | 'pendiente' | 'error'

// rojo = rojo fuerte (relleno). error = rojo suave (como "Error al subir").
// pendiente = el tono de "Sin subir" de ChipOffline (info navy/sky).
const TONOS: Record<TonoEtiqueta, string> = {
  neutral: 'bg-muted text-muted-foreground',
  menta: 'bg-agro-success-fill text-agro-success-text',
  rojo: 'bg-destructive text-destructive-foreground',
  sky: 'bg-agro-info-fill text-agro-info-text',
  pendiente: 'bg-agro-info-fill text-agro-info-text',
  error: 'bg-agro-danger-fill text-agro-danger-text',
}

interface EtiquetaProps extends React.HTMLAttributes<HTMLSpanElement> {
  tono?: TonoEtiqueta
  icono?: React.ReactNode
}

/** Píldora de estado. Uso: <Etiqueta tono="menta">Completo</Etiqueta>. Sin sombra. */
export function Etiqueta({ tono = 'neutral', icono, className, children, ...props }: EtiquetaProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold flex-shrink-0',
        TONOS[tono],
        className,
      )}
      {...props}
    >
      {icono}
      {children}
    </span>
  )
}
