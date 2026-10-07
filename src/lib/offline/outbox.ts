import { lotePut, loteGet, loteDelete, lotesPorUsuario, adjuntoPut, adjuntosDelLote, adjuntoDelete } from './db'
import type { LoteOutbox, OperacionSync, AdjuntoOutbox } from './tipos'

export type { LoteOutbox, OperacionSync, AdjuntoOutbox }

// Evento global para notificar a React cuando el outbox cambia
export const OUTBOX_CAMBIO_EVENT = 'mady:outbox-cambio'

function dispararCambio() {
  window.dispatchEvent(new CustomEvent(OUTBOX_CAMBIO_EVENT))
}

export async function encolarLote(params: {
  userId: string
  orgId: string
  modulo: string
  descripcion: string
  metadatos?: Record<string, unknown>
  operaciones: OperacionSync[]
  adjuntos?: Omit<AdjuntoOutbox, 'loteId'>[]
}): Promise<LoteOutbox> {
  const id = crypto.randomUUID()
  const adjuntosIds: string[] = []

  const lote: LoteOutbox = {
    id,
    userId: params.userId,
    orgId: params.orgId,
    capturadoEn: new Date().toISOString(),
    modulo: params.modulo,
    descripcion: params.descripcion,
    metadatos: params.metadatos,
    operaciones: params.operaciones,
    adjuntosIds,
    estado: 'pendiente',
    intentos: 0,
    error: null,
    codigo: null,
    sincronizadoEn: null,
    tarde: null,
    mapeo: null,
    creadoEn: new Date().toISOString(),
  }

  // Guardar adjuntos en store separado (Blobs no se serializan en el objeto del lote)
  if (params.adjuntos) {
    for (const adj of params.adjuntos) {
      const adjConLote: AdjuntoOutbox = { ...adj, loteId: id }
      await adjuntoPut(adjConLote)
      adjuntosIds.push(adj.uid)
    }
    lote.adjuntosIds = adjuntosIds
  }

  await lotePut(lote)
  dispararCambio()
  return lote
}

export async function obtenerLote(id: string): Promise<LoteOutbox | undefined> {
  return loteGet<LoteOutbox>(id)
}

export async function obtenerLotes(userId: string): Promise<LoteOutbox[]> {
  const todos = await lotesPorUsuario<LoteOutbox>(userId)
  return todos.sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))
}

export async function actualizarLote(id: string, updates: Partial<LoteOutbox>): Promise<void> {
  const lote = await loteGet<LoteOutbox>(id)
  if (!lote) return
  await lotePut({ ...lote, ...updates })
  dispararCambio()
}

export async function eliminarLote(id: string): Promise<void> {
  const lote = await loteGet<LoteOutbox>(id)
  if (lote) {
    for (const uid of lote.adjuntosIds) {
      await adjuntoDelete(uid).catch(() => {})
    }
  }
  await loteDelete(id)
  dispararCambio()
}

export async function obtenerAdjuntosLote(loteId: string): Promise<AdjuntoOutbox[]> {
  return adjuntosDelLote<AdjuntoOutbox>(loteId)
}

export async function contarPendientes(userId: string): Promise<number> {
  const lotes = await obtenerLotes(userId)
  return lotes.filter(l => l.estado === 'pendiente').length
}
