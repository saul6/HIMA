import { useRef, useState, type ReactNode } from 'react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Campo } from '@/app/components/ui-mady/Campo'
import { Boton } from '@/app/components/ui-mady/Boton'
import { useConexion } from '@/hooks/useConexion'
import { avisarErrorNomina } from '@/lib/nomina/errores'
import { formatoMoneda, leerCantidad, leerMonto } from '@/lib/nomina/formato'

export const CLASE_INPUT =
  'w-full h-11 px-3 rounded-xl border border-border-control bg-input-background text-sm disabled:bg-muted disabled:text-muted-foreground'
export const CLASE_TEXTAREA =
  'w-full px-3 py-2.5 rounded-xl border border-border-control bg-input-background text-sm resize-none'

/** Llave de idempotencia: se crea al montar el formulario, se reutiliza en reintentos y se renueva tras guardar. */
export function useLlave() {
  const ref = useRef<string>(crypto.randomUUID())
  return { llave: () => ref.current, renovar: () => { ref.current = crypto.randomUUID() } }
}

export function CampoTexto(props: {
  etiqueta: string
  valor: string
  onChange: (v: string) => void
  tipo?: 'text' | 'number' | 'date'
  requerido?: boolean
  min?: string
  max?: string
  disabled?: boolean
  inputMode?: 'decimal' | 'numeric' | 'text'
  placeholder?: string
  ayuda?: ReactNode
  error?: ReactNode
  maxLength?: number
}) {
  return (
    <Campo etiqueta={props.etiqueta} requerido={props.requerido} ayuda={props.ayuda} error={props.error} className="gap-1.5">
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          type={props.tipo === 'number' ? 'text' : props.tipo ?? 'text'}
          inputMode={props.inputMode ?? (props.tipo === 'number' ? 'decimal' : undefined)}
          value={props.valor}
          min={props.min}
          max={props.max}
          maxLength={props.maxLength}
          disabled={props.disabled}
          placeholder={props.placeholder}
          onChange={e => props.onChange(e.target.value)}
          className={CLASE_INPUT}
        />
      )}
    </Campo>
  )
}

/** Campo de dinero (o cantidad): valida con el lector estricto y muestra lo que se registrará. */
export function CampoMonto(props: {
  etiqueta: string
  valor: string
  onChange: (v: string) => void
  cantidad?: boolean
  requerido?: boolean
  opcional?: boolean
  moneda?: string
  error?: ReactNode
  placeholder?: string
}) {
  const vacio = props.valor.trim() === ''
  const n = props.cantidad ? leerCantidad(props.valor) : leerMonto(props.valor)
  const invalido = !vacio && Number.isNaN(n)
  const aviso = props.cantidad ? 'Escribe la cantidad como 2 o 2.5' : 'Escribe el monto como 1250 o 1,250.50'
  const error = invalido ? aviso : props.error
  const ayuda = !vacio && !invalido && !error
    ? `Se registrará: ${props.cantidad ? n : formatoMoneda(n, props.moneda)}`
    : undefined
  return (
    <CampoTexto
      etiqueta={props.etiqueta}
      valor={props.valor}
      onChange={props.onChange}
      inputMode="decimal"
      requerido={props.requerido}
      placeholder={props.placeholder}
      error={error}
      ayuda={ayuda}
    />
  )
}

export function CampoTextoLargo(props: {
  etiqueta: string
  valor: string
  onChange: (v: string) => void
  requerido?: boolean
  rows?: number
  maxLength?: number
}) {
  return (
    <Campo etiqueta={props.etiqueta} requerido={props.requerido} className="gap-1.5">
      {({ id }) => (
        <textarea
          id={id}
          rows={props.rows ?? 2}
          maxLength={props.maxLength ?? 300}
          value={props.valor}
          onChange={e => props.onChange(e.target.value)}
          className={CLASE_TEXTAREA}
        />
      )}
    </Campo>
  )
}

export function CampoSeleccion(props: {
  etiqueta: string
  valor: string
  onChange: (v: string) => void
  opciones: { valor: string; etiqueta: string }[]
  vacio?: string
  requerido?: boolean
  disabled?: boolean
}) {
  return (
    <Campo etiqueta={props.etiqueta} requerido={props.requerido} className="gap-1.5">
      {({ id }) => (
        <select
          id={id}
          value={props.valor}
          disabled={props.disabled}
          onChange={e => props.onChange(e.target.value)}
          className={CLASE_INPUT}
        >
          {props.vacio !== undefined && <option value="">{props.vacio}</option>}
          {props.opciones.map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
        </select>
      )}
    </Campo>
  )
}

/** Cuerpo estándar de un sheet con formulario: contenido + botón principal. */
export function CuerpoSheet({ children, textoGuardar, onGuardar, deshabilitado, cargando }: {
  children: ReactNode
  textoGuardar: string
  onGuardar: () => void
  deshabilitado?: boolean
  cargando?: boolean
}) {
  const { offline } = useConexion()
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">{children}</div>
      <div className="px-4 py-3 border-t border-border space-y-2">
        {offline && <p className="text-xs text-agro-info-text">Sin conexión: conéctate para guardar.</p>}
        <Boton className="w-full" cargando={cargando} disabled={deshabilitado || offline} onClick={onGuardar}>
          {textoGuardar}
        </Boton>
      </div>
    </div>
  )
}

/** Sheet para pedir un motivo (anulaciones, cancelaciones). Conserva lo escrito si falla. */
export function MotivoSheet({ titulo, descripcion, etiqueta = 'Motivo', textoConfirmar, minimo = 3, onConfirmar, onClose }: {
  titulo: string
  descripcion?: string
  etiqueta?: string
  textoConfirmar: string
  minimo?: number
  onConfirmar: (motivo: string) => Promise<void>
  onClose: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  async function confirmar() {
    setGuardando(true)
    try {
      await onConfirmar(motivo.trim())
      onClose()
    } catch (e) {
      avisarErrorNomina(e)
    } finally {
      setGuardando(false)
    }
  }
  return (
    <BottomSheet open onClose={onClose} title={titulo}>
      <CuerpoSheet textoGuardar={textoConfirmar} cargando={guardando} deshabilitado={motivo.trim().length < minimo} onGuardar={confirmar}>
        {descripcion && <p className="text-sm text-muted-foreground">{descripcion}</p>}
        <CampoTextoLargo etiqueta={etiqueta} valor={motivo} onChange={setMotivo} requerido />
      </CuerpoSheet>
    </BottomSheet>
  )
}
