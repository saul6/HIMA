import { Check } from 'lucide-react'
import { Panel } from '@/app/components/ui-mady/Panel'

// Solo escritorio (≥ lg). Panel fijo, opaco y sin movimiento: informa el avance y
// permite saltar a un paso (igual que los puntos del encabezado en celular).

export const PASOS = [
  { nombre: 'Parcela y cultivo', detalle: 'Parcela, fechas y horarios' },
  { nombre: 'Productos', detalle: 'Productos y dosis' },
  { nombre: 'Aplicación y agua', detalle: 'Equipo, agua, clima y EPP' },
  { nombre: 'Cierre', detalle: 'Sobrantes y responsables' },
] as const

interface Props {
  pasoActual: number
  alIrAPaso: (paso: number) => void
  resumen: { etiqueta: string; valor: string }[]
}

export function PanelPasos({ pasoActual, alIrAPaso, resumen }: Props) {
  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
      <Panel titulo="Pasos">
        <ol className="flex flex-col gap-1">
          {PASOS.map((p, i) => {
            const n = i + 1
            const actual = n === pasoActual
            const hecho = n < pasoActual
            return (
              <li key={p.nombre}>
                <button
                  type="button"
                  onClick={() => alIrAPaso(n)}
                  aria-current={actual ? 'step' : undefined}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  style={{ transitionDuration: 'var(--motion-fast)' }}
                >
                  <span
                    className={`flex size-7 flex-shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                      actual
                        ? 'border-transparent bg-primary text-primary-foreground'
                        : hecho
                          ? 'border-transparent bg-agro-success-fill text-agro-success-text'
                          : 'border-border-control text-muted-foreground'
                    }`}
                  >
                    {hecho ? <Check className="size-4" aria-hidden="true" /> : n}
                    {hecho && <span className="sr-only">Terminado</span>}
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate text-sm font-semibold ${actual || hecho ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {p.nombre}
                    </span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">{p.detalle}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </Panel>

      <Panel titulo="Resumen">
        <dl className="text-sm">
          {resumen.map((r) => (
            <div key={r.etiqueta} className="flex items-baseline justify-between gap-3 border-t border-border py-2 first:border-t-0 first:pt-0">
              <dt className="text-muted-foreground">{r.etiqueta}</dt>
              <dd className="min-w-0 truncate font-semibold text-foreground" title={r.valor}>{r.valor}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  )
}
