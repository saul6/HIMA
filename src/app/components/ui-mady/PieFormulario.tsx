import type { ReactNode } from 'react'
import { Boton } from './Boton'

interface PieFormularioProps {
  /** Texto del botón principal (p. ej. "Guardar"). */
  textoPrincipal: string
  onPrincipal: () => void
  onCancelar: () => void
  textoCancelar?: string
  /** Spinner en el principal; también lo deshabilita (lo resuelve `Boton`). */
  cargando?: boolean
  deshabilitado?: boolean
  /** Aviso sobre los botones (p. ej. "Sin conexión: conéctate para guardar."). */
  aviso?: ReactNode
}

/** Pie estándar de las ventanas de alta y edición: Cancelar (secundario) y la acción
 * principal, con estados de carga y deshabilitado. Va al fondo del `BottomSheet`, bajo el
 * contenido que se desplaza. `BottomSheet` no trae pie propio.
 * Uso: <PieFormulario textoPrincipal="Guardar" onPrincipal={guardar} onCancelar={cerrar} cargando={guardando} /> */
export function PieFormulario({
  textoPrincipal,
  onPrincipal,
  onCancelar,
  textoCancelar = 'Cancelar',
  cargando = false,
  deshabilitado = false,
  aviso,
}: PieFormularioProps) {
  return (
    <div className="space-y-2 border-t border-border px-4 py-3">
      {aviso}
      <div className="flex gap-3">
        <Boton type="button" variante="secundario" className="flex-1" onClick={onCancelar}>
          {textoCancelar}
        </Boton>
        <Boton type="button" className="flex-1" cargando={cargando} disabled={deshabilitado} onClick={onPrincipal}>
          {textoPrincipal}
        </Boton>
      </div>
    </div>
  )
}
