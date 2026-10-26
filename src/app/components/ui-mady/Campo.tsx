import { useId, type ReactNode } from 'react'
import { cn } from '../ui/utils'

// Etiqueta + control con el vínculo accesible resuelto. Uso:
//   <Campo etiqueta="Nombre" requerido error={error} className="gap-1.5">
//     {({ id, describedBy, invalid }) => (
//       <input id={id} aria-describedby={describedBy} aria-invalid={invalid} ... />
//     )}
//   </Campo>
// No aplica estilos al control: conserva sus clases. `claseEtiqueta` permite
// mantener el tamaño de la etiqueta que ya tenía cada formulario.

interface CampoProps {
  etiqueta: ReactNode
  ayuda?: ReactNode
  error?: ReactNode
  requerido?: boolean
  className?: string
  claseEtiqueta?: string
  children: (control: { id: string; describedBy: string | undefined; invalid: true | undefined }) => ReactNode
}

export function Campo({
  etiqueta,
  ayuda,
  error,
  requerido,
  className,
  claseEtiqueta = 'text-xs font-semibold',
  children,
}: CampoProps) {
  const id = useId()
  const ayudaId = ayuda ? `${id}-ayuda` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [ayudaId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col', className)}>
      <label htmlFor={id} className={cn('text-muted-foreground', claseEtiqueta)}>
        {etiqueta}
        {requerido && (
          <>
            <span aria-hidden="true"> *</span>
            <span className="sr-only"> obligatorio</span>
          </>
        )}
      </label>
      {children({ id, describedBy, invalid: error ? true : undefined })}
      {ayuda && <p id={ayudaId} className="text-small text-muted-foreground">{ayuda}</p>}
      {error && <p id={errorId} role="alert" className="text-small text-agro-danger-text">{error}</p>}
    </div>
  )
}
