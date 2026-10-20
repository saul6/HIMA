import * as React from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from '../ui/utils'

interface FilaRegistroProps {
  /** Ícono (32px) o, si no hay, la inicial del título. */
  icono?: React.ReactNode
  titulo: string
  subtitulo?: React.ReactNode
  /** Etiqueta o contenido a la derecha. */
  derecha?: React.ReactNode
  /** Botones de acción a la derecha (fuera del área clicable). */
  acciones?: React.ReactNode
  chevron?: boolean
  /** Con `to` es Link; con `onClick` es button; sin ninguno, fila estática. */
  to?: string
  onClick?: () => void
  className?: string
}

/** Fila de lista ~56px: ícono/inicial 32px, título 14/600, subtítulo 12 muted,
 * contenido a la derecha, chevron opcional y border-b.
 * Uso: <FilaRegistro titulo="Rancho 1" subtitulo="12 may" derecha={<Etiqueta .../>} onClick={...} /> */
export function FilaRegistro({
  icono, titulo, subtitulo, derecha, acciones, chevron, to, onClick, className,
}: FilaRegistroProps) {
  const contenido = (
    <>
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
        aria-hidden={icono ? undefined : true}
      >
        {icono ?? titulo.trim().charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold text-foreground">{titulo}</span>
        {subtitulo && <span className="block truncate text-xs text-muted-foreground">{subtitulo}</span>}
      </span>
      {derecha}
      {chevron && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
    </>
  )
  const claseZona =
    'flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

  let zona: React.ReactNode
  if (to) zona = <Link to={to} className={claseZona}>{contenido}</Link>
  else if (onClick) zona = <button type="button" onClick={onClick} className={claseZona}>{contenido}</button>
  else zona = <div className={claseZona}>{contenido}</div>

  return (
    <div className={cn('flex items-center gap-2 border-b border-border', className)}>
      {zona}
      {acciones}
    </div>
  )
}
