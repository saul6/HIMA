import type { PortadaBPM } from '@/types/database.types'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const CONDICIONES_AMBIENTALES = [
  'Sólo ambiente seco',
  'Paso de lavado de productos sin agua reutilizada',
  'Paso de lavado de producto húmedo con agua reutilizada',
  'Almacenamiento con Humedad Alta-Mojada',
]

const TIPOS_ANTIMICROBIANO = [
  'Dióxido de cloro',
  'Hipoclorito de calcio/Sodio',
  'Cloro acidificado',
  'Ácido peroxiacético',
  'Luz ultravioleta',
  'Ozono',
  'Otro',
]

function toggleItem(arr: string[] | undefined, item: string): string[] {
  const list = arr ?? []
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

function CheckList({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string[] | undefined
  onChange: (v: string[]) => void
}) {
  const sel = value ?? []
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
        {label}
      </p>
      <div className="space-y-1">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer py-0.5">
            <input
              type="checkbox"
              checked={sel.includes(opt)}
              onChange={() => onChange(toggleItem(sel, opt))}
              className="rounded"
            />
            <span className="text-sm text-foreground">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function RadioGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string | undefined
  onChange: (v: string) => void
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`h-8 px-3 rounded-lg text-xs transition-colors ${
              value === opt
                ? 'bg-primary text-white'
                : 'bg-input-background text-muted-foreground border border-border hover:bg-muted'
            }`}
            style={{ fontWeight: value === opt ? 600 : 400 }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

interface PortadaBPMFormProps {
  value: PortadaBPM
  onChange: (v: PortadaBPM) => void
}

export function PortadaBPMForm({ value, onChange }: PortadaBPMFormProps) {
  const up = (patch: Partial<PortadaBPM>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-5">

      {/* Temporada */}
      <div>
        <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
          TEMPORADA
        </p>
        <label className="flex items-center gap-2 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.temporada?.todo_el_ano ?? false}
            onChange={(e) =>
              up({ temporada: { ...value.temporada, todo_el_ano: e.target.checked } })
            }
          />
          <span className="text-sm text-foreground">Todo el año</span>
        </label>
        {!value.temporada?.todo_el_ano && (
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground mb-1">DESDE</p>
              <select
                value={value.temporada?.desde_mes ?? ''}
                onChange={(e) =>
                  up({ temporada: { ...value.temporada, desde_mes: e.target.value } })
                }
                className="w-full h-10 px-2 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Mes</option>
                {MESES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground mb-1">HASTA</p>
              <select
                value={value.temporada?.al_mes ?? ''}
                onChange={(e) =>
                  up({ temporada: { ...value.temporada, al_mes: e.target.value } })
                }
                className="w-full h-10 px-2 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Mes</option>
                {MESES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* País de destino */}
      <div>
        <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
          PAÍS DE DESTINO
        </p>
        <input
          type="text"
          value={value.pais_destino ?? ''}
          onChange={(e) => up({ pais_destino: e.target.value })}
          className="w-full h-10 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Número de trabajadores */}
      <div>
        <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
          NÚMERO DE TRABAJADORES
        </p>
        <input
          type="number"
          min={0}
          value={value.num_trabajadores ?? ''}
          onChange={(e) => up({ num_trabajadores: parseInt(e.target.value) || 0 })}
          className="w-full h-10 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Máx trabajadores temporada alta */}
      <div>
        <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
          MÁX. TRABAJADORES EN TEMPORADA ALTA
        </p>
        <input
          type="number"
          min={0}
          value={value.max_trabajadores_temporada_alta ?? ''}
          onChange={(e) => up({ max_trabajadores_temporada_alta: parseInt(e.target.value) || 0 })}
          className="w-full h-10 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Núm. líneas de operación / en auditoría */}
      <div className="flex gap-3">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
            LÍNEAS DE LA OPERACIÓN
          </p>
          <input
            type="number"
            min={0}
            value={value.num_lineas ?? ''}
            onChange={(e) => up({ num_lineas: parseInt(e.target.value) || 0 })}
            className="w-full h-10 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
            LÍNEAS EN AUDITORÍA
          </p>
          <input
            type="number"
            min={0}
            value={value.num_lineas_auditoria ?? ''}
            onChange={(e) => up({ num_lineas_auditoria: parseInt(e.target.value) || 0 })}
            className="w-full h-10 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Tamaño de instalación */}
      <div>
        <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
          TAMAÑO DE LA INSTALACIÓN
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            placeholder="Valor"
            value={value.tamano_instalacion?.valor ?? ''}
            onChange={(e) =>
              up({
                tamano_instalacion: {
                  ...value.tamano_instalacion,
                  valor: parseFloat(e.target.value) || 0,
                  unidad: value.tamano_instalacion?.unidad ?? 'Metros Cuadrados',
                },
              })
            }
            className="flex-1 h-10 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <select
            value={value.tamano_instalacion?.unidad ?? 'Metros Cuadrados'}
            onChange={(e) =>
              up({
                tamano_instalacion: {
                  ...value.tamano_instalacion,
                  valor: value.tamano_instalacion?.valor ?? 0,
                  unidad: e.target.value as 'Pies Cuadrados' | 'Metros Cuadrados',
                },
              })
            }
            className="h-10 px-2 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary"
          >
            <option value="Metros Cuadrados">m²</option>
            <option value="Pies Cuadrados">ft²</option>
          </select>
        </div>
      </div>

      <CheckList
        label="CONDICIONES AMBIENTALES"
        options={CONDICIONES_AMBIENTALES}
        value={value.condiciones_ambientales}
        onChange={(v) => up({ condiciones_ambientales: v })}
      />

      {/* Antimicrobiano en agua/hielo */}
      <div>
        <RadioGroup
          label="USO DE ANTIMICROBIANO EN AGUA/HIELO"
          options={['Sí', 'No', 'N/A']}
          value={value.antimicrobiano_agua_hielo?.uso}
          onChange={(v) =>
            up({
              antimicrobiano_agua_hielo: {
                ...value.antimicrobiano_agua_hielo,
                uso: v as 'Sí' | 'No' | 'N/A',
              },
            })
          }
        />
        {value.antimicrobiano_agua_hielo?.uso === 'Sí' && (
          <div className="mt-3">
            <CheckList
              label="TIPOS DE ANTIMICROBIANO"
              options={TIPOS_ANTIMICROBIANO}
              value={value.antimicrobiano_agua_hielo?.tipos}
              onChange={(v) =>
                up({
                  antimicrobiano_agua_hielo: {
                    ...value.antimicrobiano_agua_hielo,
                    tipos: v,
                  },
                })
              }
            />
          </div>
        )}
      </div>

      {/* Productos */}
      <div>
        <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
          PRODUCTOS MANEJADOS EN LA INSTALACIÓN
        </p>
        <p className="text-[10px] text-muted-foreground mb-2">
          Escribe cada producto y presiona Enter para agregar.
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(value.productos ?? []).map((prod) => (
            <span
              key={prod}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
              style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
            >
              {prod}
              <button
                type="button"
                onClick={() =>
                  up({ productos: (value.productos ?? []).filter((p) => p !== prod) })
                }
                className="ml-0.5 text-xs leading-none hover:opacity-70"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          placeholder="Nombre del producto..."
          className="w-full h-10 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const val = (e.target as HTMLInputElement).value.trim()
              if (val && !(value.productos ?? []).includes(val)) {
                up({ productos: [...(value.productos ?? []), val] })
              }
              ;(e.target as HTMLInputElement).value = ''
            }
          }}
        />
      </div>
    </div>
  )
}
