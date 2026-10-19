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
  /** Botones reales de la pantalla: header en celular, barrita a la derecha en escritorio. */
  acciones?: ReactNode
  /** Solo en celular (p. ej. la campana, que en escritorio ya vive en el header de arriba). */
  accionesMovil?: ReactNode
  /** Texto corto bajo el título en celular y a la izquierda de la barrita en escritorio. */
  subtitulo?: string
  /** Contenido propio del encabezado (toggle, stepper…): bajo el título en celular; en escritorio, a la izquierda de la barrita. */
  debajo?: ReactNode
  /** Con `debajo`: en escritorio va centrado como primera fila del contenido, sin barrita (p. ej. el stepper). */
  debajoCentrado?: boolean
  /** false = el header de celular no se queda fijo (cuando la pantalla ya tiene su propia barra fija). */
  fijo?: boolean
  /** Por defecto: atrás si hay historial de la app; si no, al Inicio del rol. */
  alRegresar?: () => void
}

/**
 * Encabezado de las pantallas del menú lateral.
 * Celular: flecha + título + acciones. Escritorio: el título ya lo da el header de arriba
 * (Layout), así que solo queda una barrita delgada con las acciones, si las hay.
 */
export function EncabezadoPantalla({
  titulo, acciones, accionesMovil, subtitulo, debajo, debajoCentrado, alRegresar, fijo = true,
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
    const barritaIzquierda = !debajoCentrado && debajo ? debajo : null
    return (
      <>
        <h1 className="sr-only">{titulo}</h1>
        {(acciones || subtitulo || barritaIzquierda) && (
          <div className="flex items-center justify-between gap-3 min-h-12 px-4 py-2 bg-card border-b border-border">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {subtitulo && <span className="text-xs text-muted-foreground flex-shrink-0">{subtitulo}</span>}
              {barritaIzquierda}
            </div>
            {acciones && <div className="flex items-center gap-2 flex-shrink-0">{acciones}</div>}
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
          className="p-1 rounded-lg text-muted-foreground flex-shrink-0 transition-colors hover:bg-muted active:scale-95"
          aria-label="Volver"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-foreground truncate" style={{ fontWeight: 600 }}>{titulo}</h1>
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
