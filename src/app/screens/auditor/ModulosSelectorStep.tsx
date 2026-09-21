interface ModuloItem { id: string; nombre: string }

interface Props {
  modulos: ModuloItem[]
  seleccionados: Set<string>
  onToggle: (id: string) => void
}

export function ModulosSelectorStep({ modulos, seleccionados, onToggle }: Props) {
  if (modulos.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
        No se encontraron módulos en el catálogo.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      {modulos.map(m => {
        const sel = seleccionados.has(m.id)
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onToggle(m.id)}
            className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-all"
            style={{
              backgroundColor: sel ? 'var(--accent)' : 'var(--card)',
              borderColor: sel ? 'var(--primary)' : 'var(--border)',
            }}
          >
            <div
              className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border text-[10px] font-bold"
              style={{
                backgroundColor: sel ? 'var(--primary)' : 'transparent',
                borderColor: sel ? 'var(--primary)' : 'var(--muted-foreground)',
                color: '#fff',
              }}
            >
              {sel ? '✓' : ''}
            </div>
            <p className="text-sm flex-1" style={{ color: 'var(--foreground)', fontWeight: sel ? 600 : 400 }}>
              {m.nombre}
            </p>
          </button>
        )
      })}
    </div>
  )
}
