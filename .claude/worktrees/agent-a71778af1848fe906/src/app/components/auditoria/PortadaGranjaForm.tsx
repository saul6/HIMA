import type { PortadaGranja } from '@/types/database.types'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const INSUMOS = ['Lodos Cloacales (biosólidos)', 'Compostaje a base de Animales',
  'Estiércol Animal no Tratado', 'Tratamientos de Cultivo No Sintético',
  'Enmiendas de Suelo o Sustrato', 'Fertilizantes Inorgánicos', 'N/A']

const USO_AGUA = ['Agricultura de Secano', 'Municipal/Distrito', 'Pozo',
  'Agua superficial que no fluye', 'Agua superficial de flujo abierto',
  'Agua recuperada', 'Agua de embalse']

const USO_FUENTE_AGUA = ['Enfriamiento', 'Sprays de protección de cultivos', 'Disminución de polvo',
  'Fertirrigación', 'Protección contra heladas/congelación', 'Riego', 'Otro']

const TIPO_RIEGO = ['Goteo', 'Riego por inundación', 'Riego por surcos', 'Hidropónico',
  'Micro-riego', 'Riego por filtración', 'Riego por aspersión', 'Otro']

const TIPO_INODOROS = ['No presentes', 'Inodoros Portátiles', 'Inodoros Permanentes', 'Otros']

const TIPO_TRABAJO = ['Riego', 'Plantación', 'Aplicación de pesticidas', 'Deshierbe', 'Otro']

const METODO_CULTURAL = ['Orgánico', 'Convencional', 'Transicional', 'Hidroponía', 'Otro']

// ── helpers ───────────────────────────────────────────────────────────────────

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

// ── Main component ────────────────────────────────────────────────────────────

interface PortadaGranjaFormProps {
  value: PortadaGranja
  onChange: (v: PortadaGranja) => void
}

export function PortadaGranjaForm({ value, onChange }: PortadaGranjaFormProps) {
  const up = (patch: Partial<PortadaGranja>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-5">
      {/* Tamaño de operación */}
      <div>
        <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
          TAMAÑO DE OPERACIÓN
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            placeholder="Valor"
            value={value.tamano_operacion?.valor ?? ''}
            onChange={(e) =>
              up({
                tamano_operacion: {
                  valor: parseFloat(e.target.value) || 0,
                  unidad: value.tamano_operacion?.unidad ?? 'Hectáreas',
                },
              })
            }
            className="flex-1 h-10 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <select
            value={value.tamano_operacion?.unidad ?? 'Hectáreas'}
            onChange={(e) =>
              up({
                tamano_operacion: {
                  valor: value.tamano_operacion?.valor ?? 0,
                  unidad: e.target.value as 'Hectáreas' | 'Acres',
                },
              })
            }
            className="h-10 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary"
          >
            <option>Hectáreas</option>
            <option>Acres</option>
          </select>
        </div>
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

      {/* País destino */}
      <div>
        <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
          PAÍS DESTINO
        </p>
        <input
          type="text"
          placeholder="Ej. México, Estados Unidos"
          value={value.pais_destino ?? ''}
          onChange={(e) => up({ pais_destino: e.target.value })}
          className="w-full h-10 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <CheckList
        label="INSUMOS AGRONÓMICOS UTILIZADOS"
        options={INSUMOS}
        value={value.insumos_agronomicos}
        onChange={(v) => up({ insumos_agronomicos: v })}
      />

      <CheckList
        label="USO DE AGUA (FUENTES)"
        options={USO_AGUA}
        value={value.uso_agua}
        onChange={(v) => up({ uso_agua: v })}
      />

      <CheckList
        label="USO DE FUENTE DE AGUA"
        options={USO_FUENTE_AGUA}
        value={value.uso_fuente_agua}
        onChange={(v) => up({ uso_fuente_agua: v })}
      />

      <CheckList
        label="TIPO DE RIEGO"
        options={TIPO_RIEGO}
        value={value.tipo_riego}
        onChange={(v) => up({ tipo_riego: v })}
      />

      <RadioGroup
        label="AGUA EN CONTACTO CON PARTE COMESTIBLE"
        options={['Sí', 'No']}
        value={value.agua_contacto_comestible}
        onChange={(v) => up({ agua_contacto_comestible: v as 'Sí' | 'No' })}
      />

      <div>
        <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
          AGRUPACIÓN DE PRODUCTOS / AGUA
        </p>
        <input
          type="text"
          value={value.agrupacion_productos_agua ?? ''}
          onChange={(e) => up({ agrupacion_productos_agua: e.target.value })}
          className="w-full h-10 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <CheckList
        label="TIPO DE INODOROS"
        options={TIPO_INODOROS}
        value={value.tipo_inodoros}
        onChange={(v) => up({ tipo_inodoros: v })}
      />

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
        label="TRABAJO EN CURSO"
        options={['Sí', 'No']}
        value={value.trabajo_en_curso}
        onChange={(v) => up({ trabajo_en_curso: v as 'Sí' | 'No' })}
      />

      {value.trabajo_en_curso === 'Sí' && (
        <CheckList
          label="TIPO DE TRABAJO"
          options={TIPO_TRABAJO}
          value={value.tipo_trabajo}
          onChange={(v) => up({ tipo_trabajo: v })}
        />
      )}

      <div>
        <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
          USO DE TIERRA ADYACENTE
        </p>
        <input
          type="text"
          value={value.tierra_adyacente ?? ''}
          onChange={(e) => up({ tierra_adyacente: e.target.value })}
          className="w-full h-10 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <RadioGroup
        label="MÉTODO CULTURAL"
        options={METODO_CULTURAL}
        value={value.metodo_cultural}
        onChange={(v) => up({ metodo_cultural: v })}
      />
    </div>
  )
}
