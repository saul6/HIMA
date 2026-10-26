import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'

type Tono = 'normal' | 'destacada' | 'vencida'

const BORDE: Record<Tono, string> = {
  normal: 'border-border',
  destacada: 'border-primary border-[1.5px]',
  vencida: 'border-agro-danger-text border-[1.5px]',
}

interface FilaNavegableProps {
  /** Ícono dentro de un círculo de 36 px. */
  icono?: ReactNode
  iconoTono?: 'menta' | 'neutro'
  /** Texto corto sobre el título (p. ej. "Continuar trabajo"). */
  encima?: ReactNode
  titulo: ReactNode
  /** 1 = una línea con puntos suspensivos; 2 = hasta dos líneas. */
  lineasTitulo?: 1 | 2
  subtitulo?: ReactNode
  /** Contenido bajo el título (chips, texto de apoyo). */
  pie?: ReactNode
  tono?: Tono
  onClick: () => void
}

/** Fila tocable de las listas del auditor: ícono, título, subtítulo, chevron, foco visible y 44 px mínimo. */
export function FilaNavegable({
  icono, iconoTono = 'menta', encima, titulo, lineasTitulo = 1, subtitulo, pie, tono = 'normal', onClick,
}: FilaNavegableProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex min-h-14 w-full items-center gap-3 rounded-xl border bg-card p-3 text-left',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        BORDE[tono],
        // La elevación cambia el color del borde: no en las filas con borde de énfasis.
        tono === 'normal' && 'hover-lift',
      )}
    >
      {icono && (
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full',
            iconoTono === 'menta' ? 'bg-agro-success-fill text-agro-success-text' : 'bg-muted text-muted-foreground',
          )}
          aria-hidden="true"
        >
          {icono}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {encima && <span className="text-caption font-semibold text-primary">{encima}</span>}
        <span className={cn('text-sm font-medium leading-snug text-foreground', lineasTitulo === 2 ? 'line-clamp-2' : 'truncate')}>
          {titulo}
        </span>
        {subtitulo && <span className="truncate text-xs text-muted-foreground">{subtitulo}</span>}
        {pie}
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
        style={{ transitionDuration: 'var(--motion-fast)' }}
        aria-hidden="true"
      />
    </button>
  )
}
