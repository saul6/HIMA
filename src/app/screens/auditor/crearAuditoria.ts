// Creación de auditorías del auditor: una sola llamada a `aud_auditoria_crear`, que en una
// transacción crea la instalación (si es nueva), la auditoría, sus módulos y la visita en la agenda.
import { supabase } from '@/lib/supabase'
import { hoyMX } from '@/lib/fecha'
import { fechaCorta } from '@/lib/formato'

// Mismos límites que valida el servidor.
const DIAS_ATRAS = 30
const DIAS_ADELANTE = 365
const DURACION_MAXIMA = 30

const FECHA = /^\d{4}-\d{2}-\d{2}$/

function sumarDias(fecha: string, dias: number): string | undefined {
  if (!FECHA.test(fecha)) return undefined
  const d = new Date(`${fecha}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return undefined
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function limitesInicioVisita() {
  const hoy = hoyMX()
  return { min: sumarDias(hoy, -DIAS_ATRAS)!, max: sumarDias(hoy, DIAS_ADELANTE)! }
}

export function finMaximoVisita(inicio: string): string | undefined {
  return sumarDias(inicio, DURACION_MAXIMA)
}

/** Devuelve el aviso para la persona, o null si las fechas son válidas. `fin` vacío = un día. */
export function errorFechasVisita(inicio: string, fin: string): string | null {
  if (!FECHA.test(inicio)) return 'Indica la fecha de inicio de la visita'
  const { min, max } = limitesInicioVisita()
  if (inicio < min || inicio > max) {
    return `El inicio de la visita debe estar entre el ${fechaCorta(min)} y el ${fechaCorta(max)}`
  }
  if (!fin) return null
  if (!FECHA.test(fin) || fin < inicio) return 'El fin de la visita debe ser igual o posterior al inicio'
  if (fin > finMaximoVisita(inicio)!) {
    return `El fin de la visita no puede pasar de ${DURACION_MAXIMA} días después del inicio`
  }
  return null
}

type Destino =
  | {
      p_instalacion_nueva: {
        nombre: string
        ubicacion: string
        cultivo_producto: string
        tipo_operacion: string
        contacto: string
      }
    }
  | { p_instalacion_id: string }
  | { p_rancho_id: string }

export type ParametrosCrearAuditoria = Destino & {
  /** Uno por formulario abierto: el reintento usa el mismo (idempotencia). */
  p_solicitud_id: string
  p_modulos: string[]
  p_visita_inicio: string
  p_visita_fin?: string
  p_tipo_operacion?: string
  p_producto?: string
  p_periodo?: string
}

export interface AuditoriaCreada {
  auditoria_id: string
  instalacion_id: string | null
  agenda_id: string
  fecha: string
  visita_inicio: string
  visita_fin: string
  /** true: la solicitud ya se había creado; es un éxito. */
  repetida: boolean
}

export async function crearAuditoria(params: ParametrosCrearAuditoria): Promise<AuditoriaCreada> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('aud_auditoria_crear', params)
  if (error) throw error
  return data as AuditoriaCreada
}

/** Solo se muestra el texto de los errores propios de la función (`AUD_CREAR_X: texto`). */
export function textoErrorCrear(e: unknown): string {
  const mensaje = (e as { message?: string } | null)?.message ?? ''
  const propio = /^AUD_CREAR_[A-Z0-9_]+: (.+)/s.exec(mensaje)
  return propio ? propio[1] : 'No se pudo crear la auditoría. Reintenta.'
}
