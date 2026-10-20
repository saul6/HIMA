import * as React from 'react'
import { cn } from '../ui/utils'

type VarianteTitulo = 'seccion' | 'subtitulo'

interface TituloSeccionProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** seccion = 14/600 foreground. subtitulo = 12/600 muted (grupos dentro de una sección). */
  variante?: VarianteTitulo
  /** Etiqueta HTML; por defecto h3. */
  as?: 'h2' | 'h3' | 'h4' | 'p'
}

const VARIANTES: Record<VarianteTitulo, string> = {
  seccion: 'text-sm text-foreground',
  subtitulo: 'text-xs text-muted-foreground',
}

/** Título de sección en tipo oración (nunca en mayúsculas). Margen inferior estándar mb-2.5;
 * se cambia con className (ej. "mb-0" o "mb-2"). Solo para títulos de sección: no etiquetas de
 * campo, botones ni encabezados de tabla o matriz.
 * Uso: <TituloSeccion>Datos del registro</TituloSeccion> */
export function TituloSeccion({
  variante = 'seccion',
  as: Etiqueta = 'h3',
  className,
  children,
  ...props
}: TituloSeccionProps) {
  return (
    <Etiqueta
      className={cn('font-semibold leading-snug mb-2.5', VARIANTES[variante], className)}
      {...props}
    >
      {children}
    </Etiqueta>
  )
}
