// Botón flotante de acción ("+") — posición estándar responsive, usado por
// todas las pantallas de módulo con un FAB. Unifica lo que antes eran ~74
// copias ligeramente distintas (algunas abajo-derecha, otras con el ícono
// en un color hardcodeado que se rompía en modo oscuro: text-white fijo no
// funciona cuando --primary es claro y --primary-foreground es oscuro). El
// ícono siempre usa var(--primary-foreground), nunca un color fijo.
// Móvil: franja centrada (left-1/2 -translate-x-1/2, botón al centro).
// Escritorio (md:): el sidebar ya vive a la izquierda, así que "abajo-
// derecha de la ventana" ya es abajo-derecha del contenido — basta
// right-6 bottom-6, sin descontar el ancho del sidebar.
// No se usa (todavía) dentro de AuditoriaScreen.tsx (motor M14–M18
// legacy) — ese archivo tiene su propio FAB sin migrar; queda fuera de
// alcance a propósito, no porque carezca de uno.
import type { LucideIcon } from 'lucide-react'
import { Plus } from 'lucide-react'
import { Link } from 'react-router'

interface FabProps {
  onClick?: () => void
  /** Si se pasa, el FAB navega con <Link> en vez de usar onClick. */
  to?: string
  /** Algunas pantallas migradas no traían aria-label — no se inventa una. */
  'aria-label'?: string
  /** Componente de ícono (lucide-react). Por defecto: Plus. */
  icon?: LucideIcon
  disabled?: boolean
}

const BUTTON_CLASS = [
  'pointer-events-auto w-14 h-14 bg-primary rounded-full flex items-center justify-center',
  'shadow-lg hover:bg-agro-blue transition-colors',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
  'disabled:bg-muted-foreground disabled:hover:bg-muted-foreground',
].join(' ')

export function Fab({ onClick, to, 'aria-label': ariaLabel, icon: Icon = Plus, disabled }: FabProps) {
  const iconEl = <Icon className="w-6 h-6" style={{ color: 'var(--primary-foreground)' }} />

  return (
    <div className="fixed z-10 pointer-events-none bottom-safe-fab px-4 left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-center md:left-auto md:translate-x-0 md:right-6 md:bottom-6 md:w-auto md:max-w-none md:px-0 md:justify-end">
      {to ? (
        <Link to={to} aria-label={ariaLabel} className={BUTTON_CLASS}>
          {iconEl}
        </Link>
      ) : (
        <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel} className={BUTTON_CLASS}>
          {iconEl}
        </button>
      )}
    </div>
  )
}
