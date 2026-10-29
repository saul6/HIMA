import { Files, Loader2 } from 'lucide-react'

interface BotonExportarConsolidadoProps {
  onClick: () => void
  disabled?: boolean
  cargando?: boolean
  /** `barra` (por defecto): a todo el ancho bajo el encabezado. `encabezado`: botón de tamaño principal
   * para `ModuloHeader acciones`; solo se ve desde 1224 px (donde las listas pasan a 2 columnas). La pantalla
   * que lo usa oculta la barra desde 1224 px (`min-[1224px]:hidden` en su contenedor). */
  variante?: 'barra' | 'encabezado'
}

export function BotonExportarConsolidado({ onClick, disabled, cargando, variante = 'barra' }: BotonExportarConsolidadoProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || cargando}
      className={
        variante === 'encabezado'
          ? 'hidden min-[1224px]:flex h-11 items-center justify-center gap-2 rounded-xl border border-primary px-5 text-primary text-sm hover:bg-primary/5 transition-[background-color,transform] duration-150 ease-out disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 font-semibold whitespace-nowrap'
          : 'w-full h-10 flex items-center justify-center gap-2 rounded-xl border border-primary text-primary text-sm hover:bg-primary/5 transition-[background-color,transform] duration-150 ease-out disabled:opacity-50 disabled: focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary font-semibold'
      }
    >
      {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Files className="w-4 h-4" />}
      Exportar consolidado
    </button>
  )
}
