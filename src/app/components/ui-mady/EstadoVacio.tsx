import * as React from 'react'
import type { LucideIcon } from 'lucide-react'

interface EstadoVacioProps {
  icono: LucideIcon
  titulo: string
  ayuda?: string
  accion?: React.ReactNode
}

/** Estado vacío de listas (patrón de Auditorías): ícono 40px al 40 %, título,
 * ayuda y acción opcional; centrado y sin tarjeta.
 * Uso: <EstadoVacio icono={ClipboardCheck} titulo="Sin registros" ayuda="Usa + para crear" /> */
export function EstadoVacio({ icono: Icono, titulo, ayuda, accion }: EstadoVacioProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-16">
      <Icono size={40} aria-hidden="true" style={{ color: 'var(--muted-foreground)', opacity: 0.4 }} />
      <p className="text-sm text-center text-muted-foreground">{titulo}</p>
      {ayuda && <p className="text-xs text-center text-muted-foreground">{ayuda}</p>}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  )
}
