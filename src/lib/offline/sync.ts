import { supabase } from '@/lib/supabase'
import { obtenerLotes, obtenerLote, actualizarLote, eliminarLote, obtenerAdjuntosLote } from './outbox'
import type { LoteOutbox } from './tipos'
import { setSincronizando } from './actualizacionSegura'

export const SYNC_OK_EVENT = 'mady:lote-sincronizado'
export const SYNC_RECHAZADO_EVENT = 'mady:lote-rechazado'

// ── Mensajes de error legibles ───────────────────────────────────────────────

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

function mensajeDeError(codigo: string, mensajeBD: string, modulo: string): string | null {
  switch (codigo) {
    case 'FECHA_SOLO_HOY':
    case 'SYNC_VENTANA_VENCIDA':
      return 'Pasaron más de 72 horas sin conexión; este registro ya no se puede subir.'
    case 'M12_LIMITE_SEMANAL':
    case 'BOTIQUIN_LIMITE_SEMANAL':
    case 'M7_LIMITE_QUINCENAL':
      return parsearLimiteMsg(mensajeBD, modulo)
    case 'FIRMA_REQUERIDA':
      return 'Registra tu firma en tu perfil antes de subir este registro.'
    case 'SYNC_TABLA_NO_PERMITIDA':
      return 'Este tipo de registro no puede sincronizarse. Contacta a soporte.'
    case 'SYNC_FECHA_FUTURA':
      return null // Mantener pendiente — el usuario debe ajustar fecha del dispositivo
    case '23505':
      return 'El registro ya existe en el servidor (posible duplicado).'
    case '42501':
      return 'Sin permisos para subir este registro. Verifica tu cuenta.'
    default:
      return 'No se pudo subir este registro. Reintenta más tarde.'
  }
}

// ── Subir adjuntos de un lote ─────────────────────────────────────────────────

async function subirAdjuntosLote(loteId: string): Promise<boolean> {
  const adjuntos = await obtenerAdjuntosLote(loteId)
  for (const adj of adjuntos) {
    const file = new File([adj.blob], 'foto.jpg', { type: 'image/jpeg' })
    const { error } = await supabase.storage
      .from(adj.bucket)
      .upload(adj.path, file, { contentType: 'image/jpeg', upsert: false })
    if (error) {
      // "Duplicate" = ya fue subida — OK
      if (!error.message?.toLowerCase().includes('duplicate') &&
          !error.message?.includes('409') &&
          !error.message?.includes('already exists')) {
        throw error
      }
    }
  }
  return true
}

// ── Sincronizar un único lote ─────────────────────────────────────────────────

export interface ResultadoSync {
  ok: boolean
  mapeo?: Record<string, string>
  tarde?: boolean
  codigo?: string
  error?: string
  repetido?: boolean
}

export async function sincronizarLote(loteId: string): Promise<ResultadoSync | null> {
  const lote = await obtenerLote(loteId)
  if (!lote || lote.estado !== 'pendiente') return null

  // Verificar sesión antes de intentar
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  try {
    // 1. Subir adjuntos primero
    if (lote.adjuntosIds.length > 0) {
      await subirAdjuntosLote(loteId)
    }

    // 2. Aplicar el lote via RPC
    const { data, error } = await supabase.rpc('sync_aplicar_lote', {
      p_lote_id: loteId,
      p_capturado_en: lote.capturadoEn,
      p_operaciones: lote.operaciones,
      p_dispositivo: navigator.userAgent.slice(0, 200),
    }) as { data: any; error: any }

    if (error) {
      // Errores que lanzan excepción (sesión, lote inválido, fecha futura)
      const msg = error.message ?? ''
      const codigo = error.code ?? ''
      if (msg.includes('SYNC_SIN_SESION') || msg.includes('SYNC_LOTE_INVALIDO') || msg.includes('SYNC_LOTE_AJENO')) {
        throw error
      }
      if (msg.includes('SYNC_FECHA_FUTURA') || codigo === 'SYNC_FECHA_FUTURA') {
        await actualizarLote(loteId, {
          intentos: lote.intentos + 1,
          error: 'Revisa la fecha y hora de tu dispositivo.',
          codigo: 'SYNC_FECHA_FUTURA',
        })
        return null
      }
      // Otros errores de red → reintentar
      throw error
    }

    const resultado = data as any
    if (!resultado) throw new Error('Respuesta vacía del servidor')

    if (resultado.ok === false) {
      // Rechazo de la BD (límite, candado, etc.)
      const codigo = resultado.codigo ?? 'UNKNOWN'
      const mensajeBD = resultado.mensaje ?? ''
      const msg = mensajeDeError(codigo, mensajeBD, lote.modulo) ?? mensajeBD

      if (codigo === 'SYNC_FECHA_FUTURA') {
        await actualizarLote(loteId, {
          intentos: lote.intentos + 1,
          error: 'Revisa la fecha y hora de tu dispositivo.',
          codigo,
        })
        return null
      }

      await actualizarLote(loteId, {
        estado: 'rechazado',
        error: msg,
        codigo,
        intentos: lote.intentos + 1,
      })
      window.dispatchEvent(new CustomEvent(SYNC_RECHAZADO_EVENT, { detail: { loteId, codigo, error: msg } }))
      return { ok: false, codigo, error: msg }
    }

    // Éxito
    const mapeo: Record<string, string> = resultado.mapeo ?? {}
    const tarde = resultado.tarde === true

    await actualizarLote(loteId, {
      estado: 'sincronizado',
      mapeo,
      tarde,
      sincronizadoEn: new Date().toISOString(),
      intentos: lote.intentos + 1,
      error: null,
      codigo: null,
    })

    window.dispatchEvent(new CustomEvent(SYNC_OK_EVENT, {
      detail: { loteId, modulo: lote.modulo, mapeo, tarde },
    }))

    return { ok: true, mapeo, tarde, repetido: resultado.repetido }

  } catch (err: unknown) {
    // Error de red o inesperado — mantener pendiente con reintento creciente
    const msg = err instanceof Error ? err.message : 'Error de red'
    const intentos = lote.intentos + 1
    await actualizarLote(loteId, { intentos, error: msg })
    return null
  }
}

// ── Motor de sincronización automática ────────────────────────────────────────

let sincronizando = false

async function procesarCola(userId: string): Promise<void> {
  if (sincronizando) return
  if (!navigator.onLine) return
  sincronizando = true
  setSincronizando(true)
  try {
    const lotes = await obtenerLotes(userId)
    const pendientes = lotes.filter(l => l.estado === 'pendiente')
    if (pendientes.length === 0) return

    // Refrescar token antes de sincronizar
    await supabase.auth.getSession()

    for (const lote of pendientes) {
      if (!navigator.onLine) break
      await sincronizarLote(lote.id)
    }
  } finally {
    sincronizando = false
    setSincronizando(false)
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null

export function iniciarSyncLoop(userId: string): () => void {
  if (!userId) return () => {}

  const intentarSync = () => procesarCola(userId)

  // Eventos que disparan sync
  window.addEventListener('online', intentarSync)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') intentarSync()
  })

  // Sync periódico cada 60s si hay pendientes
  if (intervalId) clearInterval(intervalId)
  intervalId = setInterval(async () => {
    const pendientes = await obtenerLotes(userId).then(l => l.filter(x => x.estado === 'pendiente').length).catch(() => 0)
    if (pendientes > 0) intentarSync()
  }, 60_000)

  // Sync inmediato al iniciar
  setTimeout(intentarSync, 500)

  return () => {
    window.removeEventListener('online', intentarSync)
    if (intervalId) { clearInterval(intervalId); intervalId = null }
  }
}
