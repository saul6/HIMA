import { Files, Loader2 } from 'lucide-react'

interface BotonExportarConsolidadoProps {
  onClick: () => void
  disabled?: boolean
  cargando?: boolean
}

export function BotonExportarConsolidado({ onClick, disabled, cargando }: BotonExportarConsolidadoProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || cargando}
      className="w-full h-10 flex items-center justify-center gap-2 rounded-xl border border-primary text-primary text-sm hover:bg-primary/5 active:scale-[0.98] transition-[background-color,transform] duration-150 ease-out disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
      style={{ fontWeight: 600 }}
    >
      {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Files className="w-4 h-4" />}
      Exportar consolidado
    </button>
  )
}
