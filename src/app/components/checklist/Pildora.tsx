import type { ReactNode } from 'react'
import { cn } from '@/app/components/ui/utils'

interface PildoraProps {
  activa: boolean
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  className?: string
}

/** Píldora de selección (estado, frecuencia, días, motivos). Activa = relleno primario. */
export function Pildora({ activa, onClick, children, disabled, className }: PildoraProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={activa}
      className={cn(
        'h-9 px-3 rounded-full border text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none',
        activa ? 'border-transparent' : 'bg-card border-border text-foreground hover:bg-muted',
        className,
      )}
      style={activa ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 600 } : undefined}
    >
      {children}
    </button>
  )
}
