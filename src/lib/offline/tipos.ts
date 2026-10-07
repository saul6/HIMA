export interface OperacionSync {
  tabla: string
  tipo?: 'insert' | 'update' | 'upsert'
  fila: Record<string, unknown>
  conflicto?: string[]
}

export interface AdjuntoOutbox {
  uid: string
  loteId: string
  blob: Blob
  path: string
  bucket: string
}

export type EstadoLote = 'pendiente' | 'sincronizado' | 'rechazado'

export interface LoteOutbox {
  id: string
  userId: string
  orgId: string
  capturadoEn: string
  modulo: string
  descripcion: string
  metadatos?: Record<string, unknown>
  operaciones: OperacionSync[]
  adjuntosIds: string[]
  estado: EstadoLote
  intentos: number
  error: string | null
  codigo: string | null
  sincronizadoEn: string | null
  tarde: boolean | null
  mapeo: Record<string, string> | null
  creadoEn: string
}
