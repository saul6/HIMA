import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { useLocation, useNavigate } from 'react-router'
import { useModulosContext } from '@/context/ModulosContext'

interface ModuloHeaderProps {
  /** Título a mostrar si la ruta actual no coincide con ningún módulo en catálogo (carga o cuenta sin el módulo). */
  tituloFallback: string
  /**
   * Título contextual que se usa TAL CUAL, sin consultar el catálogo — para pantallas con vista de
   * detalle (ej. "Agosto 2026 · Rancho X") donde el nombre del módulo en BD no aplica. Tiene prioridad
   * sobre el nombre de catálogo y sobre `tituloFallback`.
   */
  forzarTitulo?: string
  subtitulo?: string
  /** Por defecto regresa a "/". Pasar solo si la pantalla necesita otro destino/mecanismo. */
  onBack?: () => void
  /** Botones reales del lado derecho (no decorativos) — se preservan tal cual. */
  acciones?: ReactNode
}

export function ModuloHeader({ tituloFallback, forzarTitulo, subtitulo, onBack, acciones }: ModuloHeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { modulos } = useModulosContext()
  const modulo = modulos.find(m => m.ruta === location.pathname)
  const titulo = forzarTitulo ?? modulo?.nombre ?? tituloFallback
  const reducedMotion = useReducedMotion()

  return (
    <header className="bg-card border-b border-border px-4 py-4 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack ?? (() => navigate('/'))}
          className="p-1 rounded-lg text-muted-foreground flex-shrink-0 transition-colors hover:bg-muted active:scale-95"
          aria-label="Volver"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.h1
              key={titulo}
              initial={reducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="text-foreground truncate"
              style={{ fontWeight: 600 }}
            >
              {titulo}
            </motion.h1>
          </AnimatePresence>
          {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
        </div>
        {acciones && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {acciones}
          </div>
        )}
      </div>
    </header>
  )
}
