// Botón flotante de acción ("+") — posición estándar abajo-centrada, usado
// por todas las pantallas de módulo con un FAB. Unifica lo que antes eran
// ~74 copias ligeramente distintas (algunas abajo-derecha, otras con el
// ícono en un color hardcodeado que se rompía en modo oscuro: text-white
// fijo no funciona cuando --primary es claro y --primary-foreground es
// oscuro). El ícono siempre usa var(--primary-foreground), nunca un color
// fijo. No usar dentro de AuditoriaScreen.tsx (motor de auditorías M14–M18
// legacy) — ese usa un botón inline de ancho completo, patrón aparte.
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
    <div className="fixed bottom-safe-fab md:bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-center px-4 pointer-events-none z-10">
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
