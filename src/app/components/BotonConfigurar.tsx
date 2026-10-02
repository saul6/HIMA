import { Settings } from 'lucide-react'

interface BotonConfigurarProps {
  onClick: () => void
  disabled?: boolean
}

export function BotonConfigurar({ onClick, disabled }: BotonConfigurarProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Configurar"
      title="Configurar"
      className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted active:scale-[0.96] transition-[background-color,transform] duration-150 ease-out disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
    >
      <Settings className="w-3.5 h-3.5" />
    </button>
  )
}
