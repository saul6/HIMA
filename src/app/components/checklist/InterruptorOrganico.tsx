// Interruptor de la revisión orgánica. Menta solo como acento al encender; apagado usa --muted con borde --muted-foreground
// para que se vea en tema claro y oscuro. La bolita es bg-card con borde.
interface Props {
  checked: boolean
  disabled?: boolean
  onChange: () => void
  titulo: string
  ayuda: string
}

export function InterruptorOrganico({ checked, disabled, onChange, titulo, ayuda }: Props) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <div className="min-w-0">
        <p id="chk-organico-titulo" className="text-sm font-semibold">{titulo}</p>
        <p className="text-xs text-muted-foreground">{ayuda}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby="chk-organico-titulo"
        disabled={disabled}
        onClick={onChange}
        className="relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60 motion-reduce:transition-none"
        style={checked
          ? { backgroundColor: 'var(--agro-menta)', borderColor: 'var(--agro-menta)' }
          : { backgroundColor: 'var(--muted)', borderColor: 'var(--muted-foreground)' }}
      >
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-0.5 h-4 w-4 -translate-y-1/2 rounded-full border border-border bg-card transition-transform motion-reduce:transition-none"
          style={{ transform: `translate(${checked ? '1.25rem' : '0'}, -50%)` }}
        />
      </button>
    </div>
  )
}
