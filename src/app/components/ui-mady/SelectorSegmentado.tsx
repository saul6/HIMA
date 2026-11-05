// Selector segmentado de pestañas (escritorio): mismo estilo que Mis visitas / Calendario del auditor.
// Solo visual: el estado y el cambio de pestaña los maneja quien lo usa. Sin movimiento (no hay deslizamiento del fondo).
import type { KeyboardEvent, ReactNode } from 'react'

export interface OpcionSegmento<T extends string> {
  value: T
  label: ReactNode
}

interface Props<T extends string> {
  value: T
  onChange: (value: T) => void
  options: OpcionSegmento<T>[]
  /** Nombre accesible del grupo de pestañas. */
  ariaLabel: string
  className?: string
}

export function SelectorSegmentado<T extends string>({ value, onChange, options, ariaLabel, className = '' }: Props<T>) {
  function alTeclear(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const sig = (i + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length
    onChange(options[sig].value)
    const botones = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    botones?.[sig]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1 ${className}`}
    >
      {options.map((o, i) => {
        const activo = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={activo}
            tabIndex={activo ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={e => alTeclear(e, i)}
            className={`flex-shrink-0 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activo ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
            style={{ transitionDuration: 'var(--motion-fast)' }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
