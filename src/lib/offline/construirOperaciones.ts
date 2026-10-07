import type { OperacionSync } from './tipos'

export function opInsert(tabla: string, fila: Record<string, unknown>): OperacionSync {
  return { tabla, tipo: 'insert', fila: { ...fila, id: fila.id ?? crypto.randomUUID() } }
}

export function opUpdate(tabla: string, id: string, cambios: Record<string, unknown>): OperacionSync {
  return { tabla, tipo: 'update', fila: { ...cambios, id } }
}

// Para cabeceras mensuales con UNIQUE: inserta o fusiona si ya existe.
// conflicto = columnas del UNIQUE constraint (p.ej. ['rancho_id','mes']).
// Nunca incluir org_id ni creado_por — los pone el servidor.
// Excepción: si el UNIQUE incluye org_id (m28-m35, m37, m43, m45), mandarlo igual
// ya que el servidor lo sobreescribirá con el mismo valor; es necesario para que el
// servidor pueda construir el ON CONFLICT correctamente.
export function opCabecera(tabla: string, fila: Record<string, unknown>, conflicto: string[]): OperacionSync {
  return { tabla, tipo: 'insert', fila: { ...fila, id: fila.id ?? crypto.randomUUID() }, conflicto }
}

// Para celdas de matrices: inserta o actualiza si ya existe la misma combinación.
// Gana el último en sincronizar. Siempre requiere conflicto.
export function opUpsert(tabla: string, fila: Record<string, unknown>, conflicto: string[]): OperacionSync {
  return { tabla, tipo: 'upsert', fila: { ...fila, id: fila.id ?? crypto.randomUUID() }, conflicto }
}
