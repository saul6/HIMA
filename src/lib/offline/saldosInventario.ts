import { supabase } from '@/lib/supabase'
import { leerConCache } from './cacheLectura'
import { obtenerLotes } from './outbox'

export interface SaldoInventarioFila {
  rancho_id: string
  producto_id: string
  saldo: number
}

// Saldos por rancho/producto de v_inventario_saldo_rancho (RLS limita a la org).
export async function fetchSaldosInventario(): Promise<SaldoInventarioFila[]> {
  const { data, error } = await supabase
    .from('v_inventario_saldo_rancho')
    .select('rancho_id, producto_id, saldo')
  if (error) throw error
  return ((data ?? []) as Array<{ rancho_id: string; producto_id: string; saldo: number | string }>).map((r) => ({
    rancho_id: r.rancho_id,
    producto_id: r.producto_id,
    saldo: Number(r.saldo) || 0,
  }))
}

export async function leerSaldosInventarioCache(userId: string, orgId: string) {
  return leerConCache('inv_saldos', userId, orgId, fetchSaldosInventario)
}

// Movimientos de inventario de M1 que siguen en el outbox sin subir (salidas por aplicación).
// Devuelve el delta pendiente por "rancho_id|producto_id" (las salidas restan).
export async function deltaPendienteInventario(userId: string): Promise<Map<string, number>> {
  const delta = new Map<string, number>()
  const lotes = await obtenerLotes(userId)
  for (const lote of lotes) {
    if (lote.estado !== 'pendiente') continue
    for (const op of lote.operaciones) {
      if (op.tabla !== 'inventario_movimientos') continue
      const f = op.fila as { rancho_id?: string; producto_id?: string; tipo?: string; cantidad?: number }
      if (!f.rancho_id || !f.producto_id || !f.cantidad) continue
      const k = `${f.rancho_id}|${f.producto_id}`
      const signo = f.tipo === 'salida' ? -1 : 1
      delta.set(k, (delta.get(k) ?? 0) + signo * Number(f.cantidad))
    }
  }
  return delta
}
