import { Campo } from '@/app/components/ui-mady/Campo'
import { finMaximoVisita, limitesInicioVisita } from './crearAuditoria'

interface Props {
  inicio: string
  fin: string
  onInicio: (v: string) => void
  onFin: (v: string) => void
  inputStyle: React.CSSProperties
}

/** Inicio y fin (opcional) de la visita en los formularios de Empresa. */
export function CamposVisita({ inicio, fin, onInicio, onFin, inputStyle }: Props) {
  const limites = limitesInicioVisita()
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Campo etiqueta="Inicio de la visita" requerido className="gap-1.5 min-w-0">
          {({ id }) => (
            <input id={id} type="date" value={inicio} min={limites.min} max={limites.max}
              onChange={e => onInicio(e.target.value)} style={inputStyle} />
          )}
        </Campo>
        <Campo etiqueta="Fin de la visita (opcional)" className="gap-1.5 min-w-0">
          {({ id }) => (
            <input id={id} type="date" value={fin} min={inicio} max={finMaximoVisita(inicio)}
              onChange={e => onFin(e.target.value)} style={inputStyle} />
          )}
        </Campo>
      </div>
      <p className="text-caption text-muted-foreground">Sin fecha de fin, la visita es de un solo día.</p>
    </div>
  )
}
