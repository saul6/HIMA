import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { useOutbox } from '@/hooks/useOutbox'
import { leerConCache } from '@/lib/offline/cacheLectura'
import { SYNC_OK_EVENT } from '@/lib/offline/sync'

export interface M24SaldoQuimico {
  quimico_id: string
  nombre: string
  unidad: string
  stock_minimo: number | null
  saldo: number
  ultimo_movimiento: string | null
  rancho_id: string
  org_id: string
  /** El saldo incluye movimientos (o el químico) capturados sin conexión que aún no se suben */
  sin_subir?: boolean
}

export interface M24Movimiento {
  id: string
  org_id: string
  rancho_id: string
  quimico_id: string
  fecha: string
  persona_solicita: string
  area: string
  tipo: 'entrada' | 'salida'
  cantidad: number
  created_at: string
  /** Capturado sin conexión, todavía en el outbox */
  sin_subir?: boolean
}

export interface M24Quimico {
  id: string
  org_id: string
  rancho_id: string
  nombre: string
  unidad: string
  stock_minimo: number | null
  activo: boolean
  orden: number
  sin_subir?: boolean
}

// ── Pendientes del outbox (M24) ────────────────────────────────────────────────

interface PendientesM24 {
  quimicos: M24Quimico[]
  movimientos: M24Movimiento[]
}

function usePendientesM24(orgId: string | null): PendientesM24 {
  const { pendientes } = useOutbox('M24')
  return useMemo(() => {
    const quimicos: M24Quimico[] = []
    const movimientos: M24Movimiento[] = []
    for (const lote of pendientes) {
      for (const op of lote.operaciones) {
        const f = op.fila as Record<string, any>
        if (op.tabla === 'm24_quimicos') {
          quimicos.push({
            id: f.id,
            org_id: orgId ?? '',
            rancho_id: f.rancho_id,
            nombre: f.nombre,
            unidad: f.unidad,
            stock_minimo: f.stock_minimo ?? null,
            activo: true,
            orden: 0,
            sin_subir: true,
          })
        } else if (op.tabla === 'm24_movimientos') {
          movimientos.push({
            id: f.id,
            org_id: orgId ?? '',
            rancho_id: f.rancho_id,
            quimico_id: f.quimico_id,
            fecha: f.fecha,
            persona_solicita: f.persona_solicita,
            area: f.area,
            tipo: f.tipo,
            cantidad: Number(f.cantidad),
            created_at: lote.capturadoEn,
            sin_subir: true,
          })
        }
      }
    }
    return { quimicos, movimientos }
  }, [pendientes, orgId])
}

// Refresca al terminar una sincronización para traer los datos ya reales.
function useRefrescarAlSincronizar(refetch: () => void) {
  useEffect(() => {
    const h = () => refetch()
    window.addEventListener(SYNC_OK_EVENT, h)
    return () => window.removeEventListener(SYNC_OK_EVENT, h)
  }, [refetch])
}

// ── Saldos ─────────────────────────────────────────────────────────────────────

export function useM24Saldos(orgId: string | null) {
  const { user } = useAuthContext()
  const userId = user?.id ?? null
  const [base, setBase] = useState<M24SaldoQuimico[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pend = usePendientesM24(orgId)

  const fetch = useCallback(async () => {
    if (!orgId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const r = await leerConCache<M24SaldoQuimico[]>('m24_saldos', userId, orgId, async () => {
        const { data, error: err } = await (supabase as any)
          .from('v_m24_saldo_quimico')
          .select('*')
          .eq('org_id', orgId)
          .order('nombre')
        if (err) throw err
        return data ?? []
      })
      setBase(r.datos)
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar saldos')
    }
    setLoading(false)
  }, [orgId, userId])

  useEffect(() => { fetch() }, [fetch])
  useRefrescarAlSincronizar(fetch)

  // saldo en caché + movimientos pendientes; químicos nuevos sin subir se agregan como filas
  const saldos = useMemo(() => {
    if (pend.quimicos.length === 0 && pend.movimientos.length === 0) return base
    const filas = new Map<string, M24SaldoQuimico>(base.map(s => [s.quimico_id, { ...s }]))
    for (const q of pend.quimicos) {
      if (!filas.has(q.id)) {
        filas.set(q.id, {
          quimico_id: q.id, nombre: q.nombre, unidad: q.unidad, stock_minimo: q.stock_minimo,
          saldo: 0, ultimo_movimiento: null, rancho_id: q.rancho_id, org_id: q.org_id, sin_subir: true,
        })
      }
    }
    for (const m of pend.movimientos) {
      const fila = filas.get(m.quimico_id)
      if (!fila) continue
      fila.saldo += m.tipo === 'entrada' ? m.cantidad : -m.cantidad
      if (!fila.ultimo_movimiento || m.fecha > fila.ultimo_movimiento) fila.ultimo_movimiento = m.fecha
      fila.sin_subir = true
    }
    return Array.from(filas.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [base, pend])

  return { saldos, loading, error, refetch: fetch }
}

// ── Movimientos de un químico ──────────────────────────────────────────────────

export function useM24Movimientos(quimicoId: string | null, orgId: string | null) {
  const { user } = useAuthContext()
  const userId = user?.id ?? null
  const [base, setBase] = useState<M24Movimiento[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pend = usePendientesM24(orgId)

  const fetch = useCallback(async () => {
    if (!quimicoId || !orgId || !userId) { setBase([]); return }
    setLoading(true)
    setError(null)
    try {
      const r = await leerConCache<M24Movimiento[]>(`m24_movs:${quimicoId}`, userId, orgId, async () => {
        const { data, error: err } = await (supabase as any)
          .from('m24_movimientos')
          .select('*')
          .eq('org_id', orgId)
          .eq('quimico_id', quimicoId)
          .order('fecha', { ascending: true })
          .order('created_at', { ascending: true })
        if (err) throw err
        return data ?? []
      })
      setBase(r.datos)
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar movimientos')
    }
    setLoading(false)
  }, [quimicoId, orgId, userId])

  useEffect(() => { fetch() }, [fetch])
  useRefrescarAlSincronizar(fetch)

  const movimientos = useMemo(() => {
    const propios = pend.movimientos.filter(m => m.quimico_id === quimicoId)
    return propios.length === 0 ? base : [...base, ...propios]
  }, [base, pend, quimicoId])

  return { movimientos, loading, error, refetch: fetch }
}

// ── Catálogo de químicos de un rancho ──────────────────────────────────────────

export function useM24QuimicosRancho(ranchoId: string | null, orgId: string | null) {
  const { user } = useAuthContext()
  const userId = user?.id ?? null
  const [base, setBase] = useState<M24Quimico[]>([])
  const [loading, setLoading] = useState(false)
  const pend = usePendientesM24(orgId)

  const fetch = useCallback(async () => {
    if (!ranchoId || !orgId || !userId) { setBase([]); return }
    setLoading(true)
    try {
      const r = await leerConCache<M24Quimico[]>(`m24_quimicos:${ranchoId}`, userId, orgId, async () => {
        const { data, error: err } = await (supabase as any)
          .from('m24_quimicos')
          .select('*')
          .eq('org_id', orgId)
          .eq('rancho_id', ranchoId)
          .order('orden')
          .order('nombre')
        if (err) throw err
        return data ?? []
      })
      setBase(r.datos)
    } catch {
      setBase([])
    }
    setLoading(false)
  }, [ranchoId, orgId, userId])

  useEffect(() => { fetch() }, [fetch])
  useRefrescarAlSincronizar(fetch)

  const quimicos = useMemo(() => {
    const nuevos = pend.quimicos.filter(q => q.rancho_id === ranchoId && !base.some(b => b.id === q.id))
    return nuevos.length === 0 ? base : [...base, ...nuevos]
  }, [base, pend, ranchoId])

  return { quimicos, loading, refetch: fetch }
}
