// Botón flotante de acción ("+") — abajo-derecha en TODOS los breakpoints
// (móvil y escritorio, misma esquina), usado por todas las pantallas de
// módulo con un FAB. Unifica lo que antes eran ~74 copias ligeramente
// distintas: algunas centradas o a la derecha por padding suelto, otras con
// el ícono en un color hardcodeado que se rompía en modo oscuro (text-white
// fijo no funciona cuando --primary es claro y --primary-foreground es
// oscuro). El ícono siempre usa var(--primary-foreground), nunca un color
// fijo. En escritorio el sidebar vive a la izquierda, así que abajo-derecha
// de la ventana ya cae dentro del contenido — no hay que descontar su ancho.
// No se usa (todavía) dentro de AuditoriaScreen.tsx (motor M14–M18 legacy)
// — ese archivo tiene su propio FAB sin migrar; queda fuera de alcance a
// propósito, no porque carezca de uno.
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
  'fixed z-10 bottom-safe-fab right-4 md:right-6 md:bottom-6',
  'w-14 h-14 bg-primary rounded-full flex items-center justify-center',
  // `transition` (no el sufijo -colors/-transform) cubre color Y transform
  // en una sola declaración — dos utilidades transition-* por separado se
  // pisarían entre sí (cada una fija su propio transition-property).
  'shadow-lg transition hover:bg-agro-blue motion-safe:active:scale-95',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
  'disabled:bg-muted-foreground disabled:hover:bg-muted-foreground',
].join(' ')

export function Fab({ onClick, to, 'aria-label': ariaLabel, icon: Icon = Plus, disabled }: FabProps) {
  const iconEl = <Icon className="w-6 h-6" style={{ color: 'var(--primary-foreground)' }} />

  if (to) {
    return (
      <Link to={to} aria-label={ariaLabel} className={BUTTON_CLASS}>
        {iconEl}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel} className={BUTTON_CLASS}>
      {iconEl}
    </button>
  )
}
