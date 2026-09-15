import type { PortadaCosecha } from '@/types/database.types'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const TIPO_PROCESAMIENTO = ['Descorazonado en campo', 'Corte Superior y de cola', 'Florets', 'Otro']

const TIPOS_AGUA = ['Rehidratación', 'Lavado', 'Descorazonado en campo', 'Otro']

const ANTIMICROBIANO = ['Dióxido de cloro', 'Hipoclorito de calcio/Sodio', 'Cloro acidificado',
  'Ácido peroxiacético', 'Luz ultravioleta', 'Ozono', 'Otro']

const EQUIPO = ['Aparejo', 'Escaleras', 'Cubos', 'Cuchillos', 'Carros de recolección',
  'Clippers/Tijeras', 'N/A', 'Otro']

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

interface PortadaCosechaFormProps {
  value: PortadaCosecha
  onChange: (v: PortadaCosecha) => void
}

export function PortadaCosechaForm({ value, onChange }: PortadaCosechaFormProps) {
  const up = (patch: Partial<PortadaCosecha>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-5">
      {/* Nombre de campo */}
      <div>
        <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
          NOMBRE DEL CAMPO
        </p>
        <input
          type="text"
          value={value.nombre_campo ?? ''}
          onChange={(e) => up({ nombre_campo: e.target.value })}
          className="w-full h-10 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

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

      <RadioGroup
        label="PROCESO DE COSECHA"
        options={['Cosecha a mano', 'Cosecha mecánica']}
        value={value.proceso_cosecha}
        onChange={(v) => up({ proceso_cosecha: v as PortadaCosecha['proceso_cosecha'] })}
      />

      <RadioGroup
        label="PROCESAMIENTO EN CAMPO"
        options={['Sí', 'No']}
        value={value.procesamiento_en_campo}
        onChange={(v) => up({ procesamiento_en_campo: v as 'Sí' | 'No' })}
      />

      {value.procesamiento_en_campo === 'Sí' && (
        <CheckList
          label="TIPO DE PROCESAMIENTO"
          options={TIPO_PROCESAMIENTO}
          value={value.tipo_procesamiento}
          onChange={(v) => up({ tipo_procesamiento: v })}
        />
      )}

      {/* Agua poscosecha */}
      <div>
        <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
          AGUA POSCOSECHA
        </p>
        <div className="flex gap-2 mb-3">
          {(['Sí', 'No'] as const).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() =>
                up({ agua_poscosecha: { ...value.agua_poscosecha, usada: op } })
              }
              className={`flex-1 h-8 rounded-lg text-xs transition-colors ${
                value.agua_poscosecha?.usada === op
                  ? 'bg-primary text-white'
                  : 'bg-input-background text-muted-foreground border border-border hover:bg-muted'
              }`}
              style={{ fontWeight: value.agua_poscosecha?.usada === op ? 600 : 400 }}
            >
              {op}
            </button>
          ))}
        </div>
        {value.agua_poscosecha?.usada === 'Sí' && (
          <CheckList
            label="USOS DEL AGUA POSCOSECHA"
            options={TIPOS_AGUA}
            value={value.agua_poscosecha?.tipos}
            onChange={(v) =>
              up({ agua_poscosecha: { ...value.agua_poscosecha, tipos: v } })
            }
          />
        )}
      </div>

      <CheckList
        label="ANTIMICROBIANO UTILIZADO"
        options={ANTIMICROBIANO}
        value={value.antimicrobiano}
        onChange={(v) => up({ antimicrobiano: v })}
      />

      <CheckList
        label="EQUIPO USADO"
        options={EQUIPO}
        value={value.equipo_usado}
        onChange={(v) => up({ equipo_usado: v })}
      />
    </div>
  )
}
