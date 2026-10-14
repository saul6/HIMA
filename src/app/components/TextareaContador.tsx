import * as React from 'react'
import { TextareaContador } from '@/app/components/TextareaContador'

interface Props extends React.ComponentProps<'textarea'> {
  /** Máximo de caracteres (BD: 2000 en texto libre; 1000 en comentarios de auditorías M14–M18). */
  limite?: number
}

/** Textarea con `maxLength` y contador visible ("120 / 2000"). */
export function TextareaContador({ limite = 2000, value, ...props }: Props) {
  const largo = String(value ?? '').length
  const cerca = largo >= limite * 0.9
  return (
    <>
      <TextareaContador {...props} value={value} maxLength={limite} />
      <p
        className="text-[11px] text-right mt-0.5"
        style={{ color: cerca ? 'var(--agro-warning-text)' : 'var(--muted-foreground)' }}
      >
        {largo} / {limite}
      </p>
    </>
  )
}
