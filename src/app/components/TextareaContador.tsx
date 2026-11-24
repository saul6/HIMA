import * as React from 'react'
import { Textarea } from '@/app/components/ui/textarea'

interface Props extends React.ComponentProps<'textarea'> {
  /** Máximo de caracteres según la BD: usa limiteTexto('<tabla>', '<columna>'). */
  limite: number
  /** Opcional: indicador (p. ej. "Guardado") que se muestra a la izquierda, en la misma fila del contador. */
  indicador?: React.ReactNode
}

/** Textarea con `maxLength` y contador visible ("120 / 2000"). */
export function TextareaContador({ limite, value, indicador, ...props }: Props) {
  const largo = String(value ?? '').length
  const cerca = largo >= limite * 0.9
  if (indicador === undefined) {
    return (
      <>
        <Textarea {...props} value={value} maxLength={limite} />
        <p
          className="text-caption text-right mt-0.5"
          style={{ color: cerca ? 'var(--agro-info-text)' : 'var(--muted-foreground)' }}
        >
          {largo} / {limite}
        </p>
      </>
    )
  }
  return (
    <>
      <Textarea {...props} value={value} maxLength={limite} />
      <div className="flex items-start justify-between gap-2 mt-0.5 min-h-[18px]">
        <div className="flex items-center gap-2 min-w-0">{indicador}</div>
        <p
          className="text-caption text-right shrink-0"
          style={{ color: cerca ? 'var(--agro-info-text)' : 'var(--muted-foreground)' }}
        >
          {largo} / {limite}
        </p>
      </div>
    </>
  )
}
