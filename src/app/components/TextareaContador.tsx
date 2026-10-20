import * as React from 'react'
import { Textarea } from '@/app/components/ui/textarea'

interface Props extends React.ComponentProps<'textarea'> {
  /** Máximo de caracteres según la BD: usa limiteTexto('<tabla>', '<columna>'). */
  limite: number
}

/** Textarea con `maxLength` y contador visible ("120 / 2000"). */
export function TextareaContador({ limite, value, ...props }: Props) {
  const largo = String(value ?? '').length
  const cerca = largo >= limite * 0.9
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
