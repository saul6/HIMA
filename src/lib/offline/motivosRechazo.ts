import { traducirErrorBd } from '@/lib/erroresBd'
import type { LoteOutbox } from './tipos'

export const CODIGO_DEPENDE_RECHAZADO = 'DEPENDE_RECHAZADO'

function parsearLimiteMsg(mensaje: string, modulo: string): string {
  const fechas = mensaje.match(/\d{2}\/\d{2}\/\d{4}/g)
  const proxima = fechas ? fechas[fechas.length - 1] : null
  if (modulo === 'M12') {
    return proxima
      ? `Ya existe una limpieza de baños esta semana. Próxima disponible: ${proxima}.`
      : 'Solo se permite un registro de limpieza de baños por semana por sitio.'
  }
  if (modulo === 'M6' || modulo === 'M6_GG') {
    return proxima
      ? `Ya existe un registro de botiquín esta semana. Próxima disponible: ${proxima}.`
      : 'Solo se permite un registro de botiquín por semana por sitio.'
  }
  if (modulo === 'M7') {
    return proxima
      ? `Ya existe una inspección de vidrio/plástico en los últimos 14 días. Próxima disponible: ${proxima}.`
      : 'Solo se permite una inspección de vidrio/plástico cada dos semanas por sitio.'
  }
  return proxima ? `Próxima disponible: ${proxima}.` : 'Límite de frecuencia alcanzado.'
}

// Traduce el código de rechazo (o el texto crudo de la BD) a un mensaje para el usuario.
// Devuelve null solo para SYNC_FECHA_FUTURA (el lote se queda pendiente).
export function mensajeRechazo(codigo: string, mensajeBD: string, modulo: string): string | null {
  const crudo = mensajeBD ?? ''
  const tiene = (t: string) => codigo === t || crudo.includes(t)

  if (tiene('SYNC_FECHA_FUTURA')) return null
  if (tiene(CODIGO_DEPENDE_RECHAZADO)) return 'Depende de un registro con error'
  if (tiene('SYNC_VENTANA_VENCIDA')) return 'Pasaron más de 72 horas sin conexión; este registro ya no se puede subir.'
  if (tiene('FECHA_SOLO_HOY')) return 'Solo se puede registrar con la fecha de hoy.'
  if (tiene('TEXTO_MUY_LARGO')) return traducirErrorBd(crudo) ?? 'Un campo de texto excede el máximo de caracteres permitido.'
  if (tiene('FOTOS_MAXIMO')) return traducirErrorBd(crudo) ?? 'Se superó el máximo de fotos permitido.'
  if (tiene('M12_LIMITE_SEMANAL') || tiene('BOTIQUIN_LIMITE_SEMANAL') || tiene('M7_LIMITE_QUINCENAL')) {
    return parsearLimiteMsg(crudo, modulo)
  }
  if (tiene('SYNC_UPDATE_SIN_FILA')) return 'Depende de un registro que no se pudo subir.'
  if (tiene('SYNC_SIN_ID')) return 'El registro quedó incompleto en este dispositivo. Vuelve a capturarlo.'
  if (tiene('FIRMA_REQUERIDA')) return 'Registra tu firma en tu perfil antes de subir este registro.'
  if (tiene('SYNC_TABLA_NO_PERMITIDA')) return 'Este tipo de registro no puede sincronizarse. Contacta a soporte.'
  if (codigo === '42P10') return 'No se pudo ubicar el registro mensual en el servidor. Vuelve a capturarlo.'
  if (codigo === '23505') return 'El registro ya existe en el servidor (posible duplicado).'
  if (codigo === '42501') return 'Sin permisos para subir este registro. Verifica tu cuenta.'
  return 'No se pudo subir este registro. Reintenta más tarde.'
}

// Motivo legible de un lote rechazado (traduce también lotes viejos con texto crudo).
export function motivoLote(lote: LoteOutbox): string | null {
  if (lote.estado !== 'rechazado') return null
  return mensajeRechazo(lote.codigo ?? '', lote.error ?? '', lote.modulo)
    ?? 'Revisa la fecha y hora de tu dispositivo.'
}

// Ids que un lote inserta/upserta (para detectar lotes que dependen de él).
function idsCreados(lote: LoteOutbox): Set<string> {
  const ids = new Set<string>()
  for (const op of lote.operaciones) {
    if (op.tipo === 'update') continue
    const id = op.fila?.id
    if (typeof id === 'string') ids.add(id)
  }
  return ids
}

// ¿Este lote usa algún id creado por un lote rechazado (editándolo o referenciándolo)?
export function dependeDeRechazado(lote: LoteOutbox, rechazados: LoteOutbox[]): boolean {
  const bloqueados = new Set<string>()
  for (const r of rechazados) {
    if (r.id === lote.id) continue
    for (const id of idsCreados(r)) bloqueados.add(id)
  }
  if (bloqueados.size === 0) return false
  for (const op of lote.operaciones) {
    for (const v of Object.values(op.fila ?? {})) {
      if (typeof v === 'string' && bloqueados.has(v)) {
        // Un insert con su propio id nuevo no depende; solo si el id es de otro lote
        return true
      }
    }
  }
  return false
}
