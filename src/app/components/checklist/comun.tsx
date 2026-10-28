// Piezas compartidas del Checklist (M80 v2): chips, texto de registro, estados de carga/error.
import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Boton } from '@/app/components/ui-mady/Boton'
import type { CatalogoEstado, ChkDocumento, Vigencia } from '@/hooks/useChecklistV2'
import { fechaCorta } from './constantes'

interface Tono { fill: string; text: string }

const TONO_EXITO: Tono = { fill: 'var(--agro-success-fill)', text: 'var(--agro-success-text)' }
const TONO_INFO: Tono = { fill: 'var(--agro-info-fill)', text: 'var(--agro-info-text)' }
const TONO_PELIGRO: Tono = { fill: 'var(--agro-danger-fill)', text: 'var(--agro-danger-text)' }
const TONO_NEUTRO: Tono = { fill: 'var(--muted)', text: 'var(--muted-foreground)' }

export function Chip({ tono = TONO_NEUTRO, children, className = '' }: { tono?: Tono; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}
      style={{ backgroundColor: tono.fill, color: tono.text }}
    >
      {children}
    </span>
  )
}

export const TONOS = { exito: TONO_EXITO, info: TONO_INFO, peligro: TONO_PELIGRO, neutro: TONO_NEUTRO }

const VIGENCIA: Record<Vigencia, { label: string; tono: Tono }> = {
  vigente: { label: 'Vigente', tono: TONO_EXITO },
  proximo: { label: 'Por vencer', tono: TONO_INFO },
  vencido: { label: 'Vencido', tono: TONO_PELIGRO },
  sin_dato: { label: 'Sin dato', tono: TONO_NEUTRO },
}
export function ChipVigencia({ vigencia }: { vigencia: Vigencia }) {
  const v = VIGENCIA[vigencia] ?? VIGENCIA.sin_dato
  return <Chip tono={v.tono}>{v.label}</Chip>
}

const CATALOGO: Record<CatalogoEstado, { label: string; tono: Tono }> = {
  sin_catalogo: { label: 'Sin catálogo', tono: TONO_NEUTRO },
  borrador: { label: 'Borrador', tono: TONO_INFO },
  aprobado: { label: 'Aprobado', tono: TONO_EXITO },
}
export function ChipCatalogo({ estado }: { estado: CatalogoEstado }) {
  const c = CATALOGO[estado] ?? CATALOGO.sin_catalogo
  return <Chip tono={c.tono}>{c.label}</Chip>
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** Último registro respetando la precisión: día → fecha, mes → "Febrero 2026", texto → tal cual. */
export function textoRegistro(d: Pick<ChkDocumento, 'ultimo_registro_fecha' | 'ultimo_registro_texto' | 'ultimo_registro_precision'>): string {
  const { ultimo_registro_fecha: f, ultimo_registro_texto: t, ultimo_registro_precision: p } = d
  if (p === 'texto') return t ?? ''
  if (p === 'mes') {
    if (t) return t
    if (f) { const [y, m] = f.split('-').map(Number); return `${MESES[m - 1]} ${y}` }
    return ''
  }
  if (f) return fechaCorta(f)
  return t ?? ''
}

export function ErrorReintentar({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center space-y-2" role="alert">
      <p className="text-sm text-muted-foreground">{mensaje}</p>
      <button type="button" onClick={onReintentar} className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
        Reintentar
      </button>
    </div>
  )
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return <p className="text-sm text-muted-foreground text-center py-10" role="status">{texto}</p>
}

export function Aviso({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
      style={{ backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' }}
    >
      <AlertTriangle className="w-4 h-4 mt-px flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Pie fijo de un formulario en BottomSheet: Cancelar + acción principal. */
export function PieFormulario({
  onCancelar, onGuardar, textoGuardar, cargando, deshabilitado,
}: { onCancelar: () => void; onGuardar: () => void; textoGuardar: string; cargando?: boolean; deshabilitado?: boolean }) {
  return (
    <div className="flex gap-3 px-4 py-3 border-t border-border">
      <Boton type="button" variante="secundario" className="flex-1" onClick={onCancelar}>Cancelar</Boton>
      <Boton type="button" className="flex-1" cargando={cargando} disabled={deshabilitado} onClick={onGuardar}>{textoGuardar}</Boton>
    </div>
  )
}

export const CLASE_INPUT = 'w-full h-10 rounded-lg border border-border-control bg-card px-3 text-sm text-foreground'
export const CLASE_TEXTAREA = 'w-full min-h-20 rounded-lg border border-border-control bg-card px-3 py-2 text-sm text-foreground'
