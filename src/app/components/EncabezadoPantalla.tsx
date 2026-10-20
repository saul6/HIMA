import { useSyncExternalStore, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useAuthContext } from '@/context/AuthContext'

const CONSULTA_ESCRITORIO = '(min-width: 768px)'

/** true desde `md`. Un solo árbol por vez: el contenido propio (toggles, stepper con layoutId) nunca se duplica. */
function useEsEscritorio(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(CONSULTA_ESCRITORIO)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    () => window.matchMedia(CONSULTA_ESCRITORIO).matches,
    () => false,
  )
}

interface EncabezadoPantallaProps {
  /** Mismo nombre que el menú lateral. */
  titulo: string
  /** Botones reales de la pantalla: header en celular; en escritorio, primera fila del contenido a la derecha (sin fondo). */
  acciones?: ReactNode
  /** 'contenido' = en escritorio la pantalla acomoda los botones en su propia primera fila (no se dibujan aquí). */
  accionesEscritorio?: 'fila' | 'contenido'
  /** Solo en celular (p. ej. la campana, que en escritorio ya vive en el header de arriba). */
  accionesMovil?: ReactNode
  /** Texto corto bajo el título en celular (en escritorio no se muestra). */
  subtitulo?: string
  /** Contenido propio del encabezado (toggle, stepper…): bajo el título en celular; en escritorio, a la izquierda de la primera fila. */
  debajo?: ReactNode
  /** Con `debajo`: en escritorio va centrado como primera fila del contenido, (p. ej. el stepper). */
  debajoCentrado?: boolean
  /** false = el header de celular no se queda fijo (cuando la pantalla ya tiene su propia barra fija). */
  fijo?: boolean
  /** Por defecto: atrás si hay historial de la app; si no, al Inicio del rol. */
  alRegresar?: () => void
}

/**
 * Encabezado de las pantallas del menú lateral.
 * Celular: flecha + título + acciones. Escritorio: el título ya lo da el header de arriba
 * (Layout); no hay barra con fondo: las acciones van en una fila sin fondo, a la derecha, al inicio del contenido.
 */
export function EncabezadoPantalla({
  titulo, acciones, accionesEscritorio = 'fila', accionesMovil, subtitulo, debajo, debajoCentrado, alRegresar, fijo = true,
}: EncabezadoPantallaProps) {
  const navigate = useNavigate()
  const { profile } = useAuthContext()

  function regresar() {
    if (alRegresar) return alRegresar()
    const idx = (window.history.state as { idx?: number } | null)?.idx
    if (typeof idx === 'number' && idx > 0) navigate(-1)
    else navigate(profile?.rol === 'auditor' ? '/auditor' : '/')
  }

  const esEscritorio = useEsEscritorio()

  if (esEscritorio) {
    const filaIzquierda = !debajoCentrado && debajo ? debajo : null
    const accionesFila = accionesEscritorio === 'fila' ? acciones : null
    return (
      <>
        <h1 className="sr-only">{titulo}</h1>
        {(accionesFila || filaIzquierda) && (
          <div className="flex items-center justify-between gap-3 px-4 pt-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {filaIzquierda}
            </div>
            {accionesFila && <div className="flex items-center gap-2 flex-shrink-0">{accionesFila}</div>}
          </div>
        )}
        {debajoCentrado && debajo && <div className="flex justify-center pt-4">{debajo}</div>}
      </>
    )
  }

  return (
    <header className={`bg-card border-b border-border px-4 py-4${fijo ? ' sticky top-0 z-20' : ''}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={regresar}
          className="p-3 -m-2 rounded-lg text-muted-foreground flex-shrink-0 transition-colors hover:bg-muted"
          aria-label="Volver"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-foreground truncate font-semibold">{titulo}</h1>
          {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
        </div>
        {(acciones || accionesMovil) && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {acciones}
            {accionesMovil}
          </div>
        )}
      </div>
      {debajo && <div className="mt-3">{debajo}</div>}
    </header>
  )
}
