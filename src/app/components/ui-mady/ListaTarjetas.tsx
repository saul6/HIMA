import * as React from 'react'
import { cn } from '../ui/utils'

/** Ancho mínimo (px) del contenedor de la lista para pasar a 2 columnas: 2 tarjetas de ~480 px + gap.
 * Con el menú lateral de Layout equivale a una ventana de ~1224 px en escritorio. Si cambia, cambia
 * también la clase `@min-[972px]/lista:` de abajo (Tailwind exige el valor literal). */
export const ANCHO_DOS_COLUMNAS = 972

const DosColumnasContext = React.createContext(false)

/** true cuando la ListaTarjetas que contiene este componente está en 2 columnas. */
export function useListaDosColumnas(): boolean {
  return React.useContext(DosColumnasContext)
}

interface ListaTarjetasProps {
  children: React.ReactNode
  className?: string
}

/** Lista de tarjetas de registro: 1 columna y, con ≥ 972 px de contenedor, 2 columnas
 * (`items-start`: una tarjeta alta no estira a su vecina). El orden visual es el del DOM.
 * Los hijos que no son tarjeta (estado vacío, aviso de carga, tarjetas offline) van en `ListaAncho`.
 * Uso: <ListaTarjetas>{registros.map((r) => <TarjetaRegistro key={r.id} ... />)}</ListaTarjetas> */
export function ListaTarjetas({ children, className }: ListaTarjetasProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [dos, setDos] = React.useState(false)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = (ancho: number) => setDos(ancho >= ANCHO_DOS_COLUMNAS)
    medir(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entradas) => medir(entradas[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <DosColumnasContext.Provider value={dos}>
      <div ref={ref} className="@container/lista">
        <div
          className={cn(
            'grid grid-cols-1 items-start gap-3 @min-[972px]/lista:grid-cols-2 @min-[972px]/lista:pb-8',
            className,
          )}
        >
          {children}
        </div>
      </div>
    </DosColumnasContext.Provider>
  )
}

/** Hijo de ListaTarjetas que ocupa todo el ancho (estado vacío, aviso, tarjetas sin subir). */
export function ListaAncho({ children, className }: ListaTarjetasProps) {
  return <div className={cn('col-span-full', className)}>{children}</div>
}
