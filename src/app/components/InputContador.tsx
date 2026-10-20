import * as React from 'react'

interface Props extends React.ComponentProps<'input'> {
  /** Máximo de caracteres según la BD (2000 o 1000: se muestra contador). */
  limite: number
}

/** Input de texto con `maxLength` y contador visible ("120 / 2000"). */
export function InputContador({ limite, value, ...props }: Props) {
  const largo = String(value ?? '').length
  const cerca = largo >= limite * 0.9
  return (
    <>
      <input {...props} value={value} maxLength={limite} />
      <p
        className="text-[11px] text-right mt-0.5"
        style={{ color: cerca ? 'var(--agro-info-text)' : 'var(--muted-foreground)' }}
      >
        {largo} / {limite}
      </p>
    </>
  )
}
