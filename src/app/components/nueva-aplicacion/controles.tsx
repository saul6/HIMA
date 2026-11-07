import type { ReactNode } from 'react'
import { FormField } from '../FormField'
import { FormSelect } from '../FormSelect'
import { Campo } from '@/app/components/ui-mady/Campo'
import { Boton } from '@/app/components/ui-mady/Boton'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { cn } from '@/app/components/ui/utils'

// Controles del asistente de Nueva aplicación. En escritorio (≥ lg) usan las piezas
// estándar (Campo, TituloSeccion, Boton); en celular y tablet devuelven lo mismo que
// antes (FormField / FormSelect con etiqueta flotante, barras de sección).

export const CLASE_CONTROL =
  'w-full h-10 rounded-lg border border-border-control bg-input-background px-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:bg-muted disabled:text-muted-foreground'

interface CampoTextoProps {
  esLg: boolean
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number' | 'date' | 'time'
  disabled?: boolean
  placeholder?: string
  maxLength?: number
  requerido?: boolean
}

export function CampoTexto({ esLg, label, value, onChange, type = 'text', disabled, placeholder, maxLength, requerido }: CampoTextoProps) {
  if (!esLg) {
    return <FormField label={label} value={value} onChange={onChange} type={type} disabled={disabled} placeholder={placeholder} maxLength={maxLength} />
  }
  return (
    <Campo etiqueta={label} requerido={requerido} className="min-w-0 gap-1.5">
      {({ id }) => (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          className={CLASE_CONTROL}
        />
      )}
    </Campo>
  )
}

interface CampoSelectProps {
  esLg: boolean
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  requerido?: boolean
}

export function CampoSelect({ esLg, label, value, onChange, options, requerido }: CampoSelectProps) {
  if (!esLg) return <FormSelect label={label} value={value} onChange={onChange} options={options} />
  return (
    <Campo etiqueta={label} requerido={requerido} className="min-w-0 gap-1.5">
      {({ id }) => (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(CLASE_CONTROL, 'cursor-pointer')}>
          <option value="">Seleccionar...</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </Campo>
  )
}

/** Etiqueta de un grupo de opciones (segmentado, píldoras). Misma etiqueta que `Campo`. */
export function EtiquetaGrupo({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{children}</p>
}

/** Sección del paso: barra verde con `movil` (texto de siempre) en celular; en escritorio, `titulo`
 * en tipo oración con línea separadora. */
export function SeccionPaso({ esLg, titulo, movil, primera }: { esLg: boolean; titulo: string; movil: string; primera?: boolean }) {
  if (!esLg) {
    return (
      <div className="bg-agro-success-fill -mx-4 px-4 py-2">
        <h3 className="text-body text-agro-success-text font-semibold">{movil}</h3>
      </div>
    )
  }
  return (
    <div className={primera ? '' : 'border-t border-border pt-5'}>
      <TituloSeccion className="mb-0">{titulo}</TituloSeccion>
    </div>
  )
}

/** Fila de campos cortos: 2 o 3 columnas en escritorio. En celular no agrupa (o 2 columnas fijas, como antes). */
export function Fila({ esLg, cols = 2, movil2, children }: { esLg: boolean; cols?: 2 | 3; movil2?: boolean; children: ReactNode }) {
  const clase = esLg
    ? cn('grid items-start gap-4', cols === 3 ? 'grid-cols-3' : 'grid-cols-2')
    : movil2 ? 'grid grid-cols-2 gap-3' : 'contents'
  return <div className={clase}>{children}</div>
}

/** Pie del paso en escritorio: Atrás (secundario, si existe) a la izquierda y Continuar a la derecha. */
export function PiePaso({ onBack, onNext, textoNext = 'Continuar', deshabilitado, cargando }: {
  onBack?: () => void
  onNext: () => void
  textoNext?: string
  deshabilitado?: boolean
  cargando?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
      {onBack ? <Boton variante="secundario" onClick={onBack}>Atrás</Boton> : <span />}
      <Boton onClick={onNext} disabled={deshabilitado} cargando={cargando}>{textoNext}</Boton>
    </div>
  )
}
