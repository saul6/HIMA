import { AlertTriangle, CalendarClock, FileX, PenLine, Clock, ListChecks, Settings2, MoonStar, type LucideIcon } from 'lucide-react'
import type { ChkEstadoRevision, ChkTipoNota } from '@/hooks/useChecklist'

export interface TonoChip { fill: string; text: string }

export const TONO_NOTA: Record<ChkTipoNota, { icono: LucideIcon } & TonoChip> = {
  faltan_registros: { icono: AlertTriangle, fill: 'var(--agro-info-fill)', text: 'var(--agro-info-text)' },
  no_se_lleva: { icono: FileX, fill: 'var(--agro-info-fill)', text: 'var(--agro-info-text)' },
  faltan_firmas: { icono: PenLine, fill: 'var(--agro-success-fill)', text: 'var(--agro-success-text)' },
  por_vencer: { icono: Clock, fill: 'var(--agro-info-fill)', text: 'var(--agro-info-text)' },
  vencido: { icono: CalendarClock, fill: 'var(--agro-danger-fill)', text: 'var(--agro-danger-text)' },
  faltan_items: { icono: ListChecks, fill: 'var(--agro-info-fill)', text: 'var(--agro-info-text)' },
  config_pendiente: { icono: Settings2, fill: 'var(--agro-info-fill)', text: 'var(--agro-info-text)' },
  sin_actividad: { icono: MoonStar, fill: 'var(--muted)', text: 'var(--muted-foreground)' },
}

export const ESTADO_REVISION_LABEL: Record<ChkEstadoRevision, string> = {
  al_dia: 'Al día',
  actualizar: 'Actualizar',
  corregir: 'Corregir',
  faltan_firmas: 'Faltan firmas',
  sin_reportes: 'Sin reportes',
  otro: 'Otro',
}

export const TONO_ESTADO: Record<ChkEstadoRevision, TonoChip> = {
  al_dia: { fill: 'var(--agro-success-fill)', text: 'var(--agro-success-text)' },
  actualizar: { fill: 'var(--agro-info-fill)', text: 'var(--agro-info-text)' },
  corregir: { fill: 'var(--agro-danger-fill)', text: 'var(--agro-danger-text)' },
  faltan_firmas: { fill: 'var(--agro-info-fill)', text: 'var(--agro-info-text)' },
  sin_reportes: { fill: 'var(--muted)', text: 'var(--muted-foreground)' },
  otro: { fill: 'var(--muted)', text: 'var(--foreground)' },
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** 'YYYY-MM-DD' (o ISO) → "18 de octubre". Sin pasar por Date para no correr el día por zona horaria. */
export function fechaLarga(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return ''
  return `${d} de ${MESES[m - 1]}`
}

export function haceDias(n: number | null | undefined): string {
  if (n == null) return 'Sin revisar'
  if (n <= 0) return 'hoy'
  if (n === 1) return 'hace 1 día'
  return `hace ${n} días`
}

export const DIAS_SEMANA = [
  { n: 1, letra: 'L', nombre: 'Lunes' },
  { n: 2, letra: 'M', nombre: 'Martes' },
  { n: 3, letra: 'M', nombre: 'Miércoles' },
  { n: 4, letra: 'J', nombre: 'Jueves' },
  { n: 5, letra: 'V', nombre: 'Viernes' },
  { n: 6, letra: 'S', nombre: 'Sábado' },
  { n: 7, letra: 'D', nombre: 'Domingo' },
]
