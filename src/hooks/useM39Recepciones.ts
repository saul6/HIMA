import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { useOutbox } from '@/hooks/useOutbox'
import { leerConCache } from '@/lib/offline/cacheLectura'
import { SYNC_OK_EVENT } from '@/lib/offline/sync'
import { codigoProvisional } from '@/lib/offline/codigoProvisional'

export interface M39RecepcionResumen {
  id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  empresa: string | null
  hoja_no: string | null
  total_6oz: number
  total_12oz: number
  total_18oz: number
  total_cajas: number
  total_piezas: number
  /** Capturada sin conexión; los códigos LR reales los genera el servidor al sincronizar */
  sin_subir?: boolean
  codigos_provisionales?: string[]
}

const tbl = (name: string) => (supabase as any).from(name)

// Las líneas de almacén guardan una copia del código LR (m39_lineas.codigo_trazabilidad).
// Sin red el LR se crea al sincronizar y su código real aún no existe: la línea se sube con
// el código vacío y, ya con red, se completa desde el LR (lo que usan el PDF y las listas).
async function completarCodigosTrazabilidad(orgId: string): Promise<void> {
  try {
    const { data: pend } = await tbl('m39_lineas')
      .select('id, lr_id')
      .eq('org_id', orgId)
      .is('codigo_trazabilidad', null)
      .not('lr_id', 'is', null)
    if (!pend || pend.length === 0) return
    const lrIds = [...new Set((pend as any[]).map(l => l.lr_id as string))]
    const { data: lrs } = await tbl('m48_lotes_recepcion').select('id, codigo').in('id', lrIds)
    for (const lr of (lrs ?? []) as Array<{ id: string; codigo: string | null }>) {
      if (!lr.codigo) continue
      await tbl('m39_lineas')
        .update({ codigo_trazabilidad: lr.codigo })
        .eq('org_id', orgId)
        .eq('lr_id', lr.id)
        .is('codigo_trazabilidad', null)
    }
  } catch {
    // Reintenta en la siguiente carga; no bloquea la pantalla
  }
}

export function useM39Recepciones() {
  const { profile, user } = useAuthContext()
  const userId = user?.id ?? null
  const { pendientes, sincronizados } = useOutbox('M39')
  const [base, setBase] = useState<M39RecepcionResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hayLotesSincronizados = sincronizados.length > 0

  const cargar = useCallback(async () => {
    if (!profile?.org_id || !userId) { setLoading(false); return }
    const orgId = profile.org_id
    setLoading(true); setError(null)
    try {
      if (navigator.onLine && hayLotesSincronizados) await completarCodigosTrazabilidad(orgId)
      const resultado = await leerConCache('m39_recepciones', userId, orgId, async () => {
        const { data, error: err } = await tbl('m39_recepciones')
          .select('id, rancho_id, fecha, empresa, hoja_no, ranchos(nombre), m39_lineas(cant_6oz, cant_12oz, cant_18oz, cajas, piezas)')
          .eq('org_id', orgId)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false })
        if (err) throw err
        return data ?? []
      })
      setBase((resultado.datos as any[]).map((r) => {
        const lineas: any[] = r.m39_lineas ?? []
        const sum = (field: string) => lineas.reduce((s: number, l: any) => s + (l[field] ?? 0), 0)
        return {
          id: r.id,
          rancho_id: r.rancho_id,
          rancho_nombre: r.ranchos?.nombre ?? '—',
          fecha: r.fecha,
          empresa: r.empresa ?? null,
          hoja_no: r.hoja_no ?? null,
          total_6oz: sum('cant_6oz'),
          total_12oz: sum('cant_12oz'),
          total_18oz: sum('cant_18oz'),
          total_cajas: sum('cajas'),
          total_piezas: sum('piezas'),
        }
      }))
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Error al cargar recepciones M39')
    } finally { setLoading(false) }
  }, [profile?.org_id, userId, hayLotesSincronizados])

  useEffect(() => { cargar() }, [cargar])

  // Al sincronizar vuelve a leer para mostrar el registro ya real (y completar los códigos LR)
  useEffect(() => {
    const h = (ev: Event) => {
      const modulo = (ev as CustomEvent<{ modulo?: string }>).detail?.modulo
      if (!modulo || modulo === 'M39') {
        if (profile?.org_id && navigator.onLine) {
          completarCodigosTrazabilidad(profile.org_id).finally(() => cargar())
        }
      }
    }
    window.addEventListener(SYNC_OK_EVENT, h)
    return () => window.removeEventListener(SYNC_OK_EVENT, h)
  }, [cargar, profile?.org_id])

  // Recepciones capturadas sin conexión (aún en el outbox)
  const recepciones = useMemo(() => {
    if (pendientes.length === 0) return base
    const locales: M39RecepcionResumen[] = []
    for (const lote of pendientes) {
      const meta = (lote.metadatos ?? {}) as { rancho_nombre?: string }
      const ops = lote.operaciones
      const rec = ops.find(o => o.tabla === 'm39_recepciones')?.fila as Record<string, any> | undefined
      if (!rec) continue
      const lineas = ops.filter(o => o.tabla === 'm39_lineas').map(o => o.fila as Record<string, any>)
      const sum = (field: string) => lineas.reduce((s, l) => s + (Number(l[field]) || 0), 0)
      const lrs = ops.filter(o => o.tabla === 'm48_lotes_recepcion').map(o => codigoProvisional((o.fila as any).id))
      locales.push({
        id: rec.id,
        rancho_id: rec.rancho_id,
        rancho_nombre: meta.rancho_nombre ?? '—',
        fecha: rec.fecha,
        empresa: rec.empresa ?? null,
        hoja_no: rec.hoja_no ?? null,
        total_6oz: sum('cant_6oz'),
        total_12oz: sum('cant_12oz'),
        total_18oz: sum('cant_18oz'),
        total_cajas: sum('cajas'),
        total_piezas: sum('piezas'),
        sin_subir: true,
        codigos_provisionales: lrs,
      })
    }
    return [...locales.reverse(), ...base]
  }, [base, pendientes])

  return { recepciones, loading, error, refetch: cargar }
}
