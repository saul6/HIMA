import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { useOutbox } from '@/hooks/useOutbox'
import { leerConCache } from '@/lib/offline/cacheLectura'
import { cacheGet } from '@/lib/offline/db'
import { SYNC_OK_EVENT } from '@/lib/offline/sync'
import { codigoProvisional } from '@/lib/offline/codigoProvisional'
import type { LoteOutbox } from '@/lib/offline/tipos'

const tbl = (name: string) => (supabase as any).from(name)

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface M48LoteRecepcion {
  id: string
  org_id: string
  rancho_id: string
  rancho_nombre: string
  fecha: string
  hora: string | null
  proveedor_nombre: string
  proveedor_origen: string | null
  proveedor_codigo: string | null
  cantidad: number | null
  unidad: string | null
  condicion_vehiculo: string | null
  resultado: 'aceptado' | 'rechazado' | 'retenido' | 'condicionado' | null
  responsable: string | null
  observaciones: string | null
  codigo: string
  consecutivo: number
  created_at: string  /** Capturado sin conexión: el código es provisional hasta que el servidor genere el real */
  sin_subir?: boolean
}

export interface M48LoteProducto {
  id: string
  org_id: string
  rancho_id: string
  fecha_empaque: string
  turno: number
  presentacion: string | null
  lr_id: string | null
  lc_id: string | null
  lr_codigo: string | null
  lc_codigo: string | null
  hora_inicio: string | null
  hora_termino: string | null
  cant_ingresada: number | null
  cant_empacada: number | null
  rechazo_merma: number | null
  pendiente_retenido: number | null
  responsable: string | null
  observaciones: string | null
  codigo: string
  created_at: string  /** Capturado sin conexión: el código es provisional hasta que el servidor genere el real */
  sin_subir?: boolean
}

export interface M48LrEnLC {
  id: string
  codigo: string
  proveedor_nombre: string
  fecha: string
}

export interface M48LoteCompuesto {
  id: string
  org_id: string
  rancho_id: string
  fecha: string
  motivo: string | null
  observaciones: string | null
  codigo: string
  lotes_recepcion: M48LrEnLC[]
  created_at: string  /** Capturado sin conexión: el código es provisional hasta que el servidor genere el real */
  sin_subir?: boolean
}

export interface M48LptEnFE {
  lpt_id: string
  lpt_codigo: string
  numero_tarima: number | null
  cantidad: number | null
  cliente: string | null
}

export interface M48FolioEmbarque {
  id: string
  org_id: string
  rancho_id: string
  fecha: string
  cliente: string | null
  transporte_linea: string | null
  transporte_placas: string | null
  transporte_caja: string | null
  chofer: string | null
  condiciones_limpieza: string | null
  sello: string | null
  equipo_temp: string | null
  condiciones_embarque: string | null
  total_embarcado: number | null
  observaciones: string | null
  codigo: string
  lotes_producto: M48LptEnFE[]
  created_at: string  /** Capturado sin conexión: el código es provisional hasta que el servidor genere el real */
  sin_subir?: boolean
}

export interface TrazabilidadNodo {
  tipo: 'LR' | 'LPT' | 'LC' | 'FE'
  registro: any
  // Para LR: LPTs derivados
  lpts?: M48LoteProducto[]
  folios?: M48FolioEmbarque[]
  // Para LPT: origen y folios
  origen?: { tipo: 'LR' | 'LC'; registro: M48LoteRecepcion | M48LoteCompuesto; lrs?: M48LoteRecepcion[] } | null
  // Para LC: LRs componentes
  lrs?: M48LoteRecepcion[]
  // Para FE: LPTs incluidos
  lptsDeFe?: Array<M48LptEnFE & { lpt: M48LoteProducto }>
}

// ── Hooks ────────────────────────────────────────────────────────────────────
// Lectura con caché + registros capturados sin conexión (outbox). Sin red, los lotes nuevos
// se muestran con un código provisional local (PROV-xxxxxx); el código real (LR, LC, LPT, FE)
// lo genera el servidor al sincronizar y se vuelve a leer al terminar la sincronización.

function useRecargarAlSincronizar(recargar: () => void) {
  useEffect(() => {
    const h = () => recargar()
    window.addEventListener(SYNC_OK_EVENT, h)
    return () => window.removeEventListener(SYNC_OK_EVENT, h)
  }, [recargar])
}

// Códigos reales (id → codigo) de otras listas M48 ya en caché, para rotular relaciones
function useCodigosEnCache(orgId: string | null, ranchoId: string | null, prefijos: string[]) {
  const { user } = useAuthContext()
  const userId = user?.id ?? null
  const [mapa, setMapa] = useState<Map<string, string>>(new Map())
  const clave = prefijos.join('|')
  useEffect(() => {
    if (!orgId || !ranchoId || !userId) { setMapa(new Map()); return }
    let activo = true
    ;(async () => {
      const m = new Map<string, string>()
      for (const p of clave.split('|')) {
        try {
          const entrada = await cacheGet<{ datos: any[]; userId: string; orgId: string }>(`${p}:${ranchoId}`)
          if (!entrada || entrada.userId !== userId || entrada.orgId !== orgId) continue
          for (const x of entrada.datos) if (x?.id && x?.codigo) m.set(x.id, x.codigo)
        } catch { /* sin caché de esa lista */ }
      }
      if (activo) setMapa(m)
    })()
    return () => { activo = false }
  }, [orgId, ranchoId, userId, clave])
  return mapa
}

function filasPendientes(pendientes: LoteOutbox[], tabla: string, ranchoId: string | null) {
  const out: Array<{ fila: Record<string, any>; lote: LoteOutbox }> = []
  for (const lote of pendientes) {
    for (const op of lote.operaciones) {
      if (op.tabla !== tabla) continue
      const fila = op.fila as Record<string, any>
      if (ranchoId && fila.rancho_id && fila.rancho_id !== ranchoId) continue
      out.push({ fila, lote })
    }
  }
  return out
}

export function useM48LotesRecepcion(orgId: string | null, ranchoId: string | null) {
  const { user } = useAuthContext()
  const userId = user?.id ?? null
  const { pendientes } = useOutbox()
  const [base, setBase] = useState<M48LoteRecepcion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!orgId || !ranchoId || !userId) { setBase([]); return }
    setLoading(true); setError(null)
    try {
      const r = await leerConCache<any[]>(`m48_lr:${ranchoId}`, userId, orgId, async () => {
        const { data, error: err } = await tbl('m48_lotes_recepcion')
          .select('*, ranchos(nombre)')
          .eq('org_id', orgId)
          .eq('rancho_id', ranchoId)
          .order('created_at', { ascending: false })
        if (err) throw err
        return (data ?? []).map((x: any) => ({ ...x, rancho_nombre: x.ranchos?.nombre ?? '—' }))
      })
      setBase(r.datos as M48LoteRecepcion[])
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Error al cargar LR')
    } finally { setLoading(false) }
  }, [orgId, ranchoId, userId])

  useEffect(() => { cargar() }, [cargar])
  useRecargarAlSincronizar(cargar)

  const lotes = useMemo(() => {
    const nuevos: M48LoteRecepcion[] = filasPendientes(pendientes, 'm48_lotes_recepcion', ranchoId)
      .filter(({ fila }) => !base.some(b => b.id === fila.id))
      .map(({ fila, lote }) => ({
        ...(fila as any),
        org_id: orgId ?? '',
        rancho_nombre: (lote.metadatos as any)?.rancho_nombre ?? '—',
        codigo: codigoProvisional(fila.id),
        consecutivo: 0,
        created_at: lote.capturadoEn,
        sin_subir: true,
      }))
    return nuevos.length === 0 ? base : [...nuevos.reverse(), ...base]
  }, [base, pendientes, ranchoId, orgId])

  return { lotes, loading, error, refetch: cargar }
}

export function useM48LotesProducto(orgId: string | null, ranchoId: string | null) {
  const { user } = useAuthContext()
  const userId = user?.id ?? null
  const { pendientes } = useOutbox()
  const [base, setBase] = useState<M48LoteProducto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const codigos = useCodigosEnCache(orgId, ranchoId, ['m48_lr', 'm48_lc'])

  const cargar = useCallback(async () => {
    if (!orgId || !ranchoId || !userId) { setBase([]); return }
    setLoading(true); setError(null)
    try {
      const r = await leerConCache<any[]>(`m48_lpt:${ranchoId}`, userId, orgId, async () => {
        const { data, error: err } = await tbl('m48_lotes_producto')
          .select('*, m48_lotes_recepcion(codigo), m48_lotes_compuestos(codigo)')
          .eq('org_id', orgId)
          .eq('rancho_id', ranchoId)
          .order('created_at', { ascending: false })
        if (err) throw err
        return (data ?? []).map((x: any) => ({
          ...x,
          lr_codigo: x.m48_lotes_recepcion?.codigo ?? null,
          lc_codigo: x.m48_lotes_compuestos?.codigo ?? null,
        }))
      })
      setBase(r.datos as M48LoteProducto[])
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Error al cargar LPT')
    } finally { setLoading(false) }
  }, [orgId, ranchoId, userId])

  useEffect(() => { cargar() }, [cargar])
  useRecargarAlSincronizar(cargar)

  const lotes = useMemo(() => {
    const codigoDe = (id: string | null) => id ? (codigos.get(id) ?? codigoProvisional(id)) : null
    const nuevos: M48LoteProducto[] = filasPendientes(pendientes, 'm48_lotes_producto', ranchoId)
      .filter(({ fila }) => !base.some(b => b.id === fila.id))
      .map(({ fila, lote }) => ({
        ...(fila as any),
        org_id: orgId ?? '',
        lr_codigo: codigoDe(fila.lr_id ?? null),
        lc_codigo: codigoDe(fila.lc_id ?? null),
        codigo: codigoProvisional(fila.id),
        created_at: lote.capturadoEn,
        sin_subir: true,
      }))
    return nuevos.length === 0 ? base : [...nuevos.reverse(), ...base]
  }, [base, pendientes, ranchoId, orgId, codigos])

  return { lotes, loading, error, refetch: cargar }
}

export function useM48LotesCompuestos(orgId: string | null, ranchoId: string | null) {
  const { user } = useAuthContext()
  const userId = user?.id ?? null
  const { pendientes } = useOutbox()
  const [base, setBase] = useState<M48LoteCompuesto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const codigos = useCodigosEnCache(orgId, ranchoId, ['m48_lr'])

  const cargar = useCallback(async () => {
    if (!orgId || !ranchoId || !userId) { setBase([]); return }
    setLoading(true); setError(null)
    try {
      const r = await leerConCache<any[]>(`m48_lc:${ranchoId}`, userId, orgId, async () => {
        const { data, error: err } = await tbl('m48_lotes_compuestos')
          .select('*, m48_lc_lr(lr_id, m48_lotes_recepcion(id, codigo, proveedor_nombre, fecha))')
          .eq('org_id', orgId)
          .eq('rancho_id', ranchoId)
          .order('created_at', { ascending: false })
        if (err) throw err
        return (data ?? []).map((x: any) => ({
          ...x,
          lotes_recepcion: ((x.m48_lc_lr ?? []) as any[]).map((rel: any) => ({
            id: rel.m48_lotes_recepcion?.id ?? rel.lr_id,
            codigo: rel.m48_lotes_recepcion?.codigo ?? '—',
            proveedor_nombre: rel.m48_lotes_recepcion?.proveedor_nombre ?? '—',
            fecha: rel.m48_lotes_recepcion?.fecha ?? '',
          })),
        }))
      })
      setBase(r.datos as M48LoteCompuesto[])
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Error al cargar LC')
    } finally { setLoading(false) }
  }, [orgId, ranchoId, userId])

  useEffect(() => { cargar() }, [cargar])
  useRecargarAlSincronizar(cargar)

  const lotes = useMemo(() => {
    const lrsPend = filasPendientes(pendientes, 'm48_lotes_recepcion', null)
    const nuevos: M48LoteCompuesto[] = filasPendientes(pendientes, 'm48_lotes_compuestos', ranchoId)
      .filter(({ fila }) => !base.some(b => b.id === fila.id))
      .map(({ fila, lote }) => {
        const rels = lote.operaciones
          .filter(o => o.tabla === 'm48_lc_lr' && (o.fila as any).lc_id === fila.id)
          .map(o => (o.fila as any).lr_id as string)
        return {
          ...(fila as any),
          org_id: orgId ?? '',
          codigo: codigoProvisional(fila.id),
          created_at: lote.capturadoEn,
          sin_subir: true,
          lotes_recepcion: rels.map(lrId => {
            const lrLocal = lrsPend.find(x => x.fila.id === lrId)?.fila
            return {
              id: lrId,
              codigo: codigos.get(lrId) ?? codigoProvisional(lrId),
              proveedor_nombre: lrLocal?.proveedor_nombre ?? '—',
              fecha: lrLocal?.fecha ?? '',
            }
          }),
        }
      })
    return nuevos.length === 0 ? base : [...nuevos.reverse(), ...base]
  }, [base, pendientes, ranchoId, orgId, codigos])

  return { lotes, loading, error, refetch: cargar }
}

export function useM48FoliosEmbarque(orgId: string | null, ranchoId: string | null) {
  const { user } = useAuthContext()
  const userId = user?.id ?? null
  const { pendientes } = useOutbox()
  const [base, setBase] = useState<M48FolioEmbarque[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const codigos = useCodigosEnCache(orgId, ranchoId, ['m48_lpt'])

  const cargar = useCallback(async () => {
    if (!orgId || !ranchoId || !userId) { setBase([]); return }
    setLoading(true); setError(null)
    try {
      const r = await leerConCache<any[]>(`m48_fe:${ranchoId}`, userId, orgId, async () => {
        const { data, error: err } = await tbl('m48_folios_embarque')
          .select('*, m48_fe_lpt(lpt_id, numero_tarima, cantidad, cliente, m48_lotes_producto(codigo))')
          .eq('org_id', orgId)
          .eq('rancho_id', ranchoId)
          .order('created_at', { ascending: false })
        if (err) throw err
        return (data ?? []).map((x: any) => ({
          ...x,
          lotes_producto: ((x.m48_fe_lpt ?? []) as any[]).map((rel: any) => ({
            lpt_id: rel.lpt_id,
            lpt_codigo: rel.m48_lotes_producto?.codigo ?? '—',
            numero_tarima: rel.numero_tarima ?? null,
            cantidad: rel.cantidad ?? null,
            cliente: rel.cliente ?? null,
          })),
        }))
      })
      setBase(r.datos as M48FolioEmbarque[])
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Error al cargar FE')
    } finally { setLoading(false) }
  }, [orgId, ranchoId, userId])

  useEffect(() => { cargar() }, [cargar])
  useRecargarAlSincronizar(cargar)

  const folios = useMemo(() => {
    const nuevos: M48FolioEmbarque[] = filasPendientes(pendientes, 'm48_folios_embarque', ranchoId)
      .filter(({ fila }) => !base.some(b => b.id === fila.id))
      .map(({ fila, lote }) => ({
        ...(fila as any),
        org_id: orgId ?? '',
        codigo: codigoProvisional(fila.id),
        created_at: lote.capturadoEn,
        sin_subir: true,
        lotes_producto: lote.operaciones
          .filter(o => o.tabla === 'm48_fe_lpt' && (o.fila as any).fe_id === fila.id)
          .map(o => {
            const rel = o.fila as any
            return {
              lpt_id: rel.lpt_id,
              lpt_codigo: codigos.get(rel.lpt_id) ?? codigoProvisional(rel.lpt_id),
              numero_tarima: rel.numero_tarima ?? null,
              cantidad: rel.cantidad ?? null,
              cliente: rel.cliente ?? null,
            }
          }),
      }))
    return nuevos.length === 0 ? base : [...nuevos.reverse(), ...base]
  }, [base, pendientes, ranchoId, orgId, codigos])

  return { folios, loading, error, refetch: cargar }
}

// ── Consulta de trazabilidad ─────────────────────────────────────────────────

export async function consultarTrazabilidad(codigo: string, orgId: string): Promise<TrazabilidadNodo | null> {
  const cod = codigo.trim().toUpperCase()

  if (cod.startsWith('LR-')) {
    const { data: lr } = await tbl('m48_lotes_recepcion')
      .select('*').eq('codigo', cod).eq('org_id', orgId).maybeSingle()
    if (!lr) return null
    // LPTs generados desde este LR
    const { data: lpts } = await tbl('m48_lotes_producto')
      .select('*, m48_lotes_recepcion(codigo), m48_lotes_compuestos(codigo)')
      .eq('lr_id', lr.id).eq('org_id', orgId).order('created_at', { ascending: false })
    // FEs para cada LPT
    const lptIds = (lpts ?? []).map((l: any) => l.id)
    let folios: M48FolioEmbarque[] = []
    if (lptIds.length > 0) {
      const { data: feRels } = await tbl('m48_fe_lpt')
        .select('fe_id, m48_folios_embarque!inner(*, m48_fe_lpt(lpt_id, numero_tarima, cantidad, cliente, m48_lotes_producto(codigo)))')
        .in('lpt_id', lptIds)
      folios = [...new Map(((feRels ?? []) as any[]).map((r: any) => [r.fe_id, r.m48_folios_embarque])).values()].map((fe: any) => ({
        ...fe,
        lotes_producto: ((fe.m48_fe_lpt ?? []) as any[]).map((rel: any) => ({
          lpt_id: rel.lpt_id, lpt_codigo: rel.m48_lotes_producto?.codigo ?? '—',
          numero_tarima: rel.numero_tarima, cantidad: rel.cantidad, cliente: rel.cliente,
        })),
      }))
    }
    return {
      tipo: 'LR', registro: lr,
      lpts: ((lpts ?? []) as any[]).map((r: any) => ({ ...r, lr_codigo: r.m48_lotes_recepcion?.codigo ?? null, lc_codigo: null })),
      folios,
    }
  }

  if (cod.startsWith('LPT-')) {
    const { data: lpt } = await tbl('m48_lotes_producto')
      .select('*, m48_lotes_recepcion(*, ranchos(nombre)), m48_lotes_compuestos(*, m48_lc_lr(lr_id, m48_lotes_recepcion(id,codigo,proveedor_nombre,fecha)))')
      .eq('codigo', cod).eq('org_id', orgId).maybeSingle()
    if (!lpt) return null
    let origen: TrazabilidadNodo['origen'] = null
    if (lpt.m48_lotes_recepcion) {
      origen = { tipo: 'LR', registro: { ...lpt.m48_lotes_recepcion, rancho_nombre: lpt.m48_lotes_recepcion.ranchos?.nombre ?? '—' } }
    } else if (lpt.m48_lotes_compuestos) {
      const lc = lpt.m48_lotes_compuestos
      const lrs = ((lc.m48_lc_lr ?? []) as any[]).map((rel: any) => ({
        ...rel.m48_lotes_recepcion, rancho_nombre: '—'
      }))
      origen = { tipo: 'LC', registro: { ...lc, lotes_recepcion: lrs }, lrs }
    }
    const { data: feRels } = await tbl('m48_fe_lpt')
      .select('fe_id, m48_folios_embarque!inner(*, m48_fe_lpt(lpt_id, numero_tarima, cantidad, cliente, m48_lotes_producto(codigo)))')
      .eq('lpt_id', lpt.id)
    const folios = [...new Map(((feRels ?? []) as any[]).map((r: any) => [r.fe_id, r.m48_folios_embarque])).values()].map((fe: any) => ({
      ...fe,
      lotes_producto: ((fe.m48_fe_lpt ?? []) as any[]).map((rel: any) => ({
        lpt_id: rel.lpt_id, lpt_codigo: rel.m48_lotes_producto?.codigo ?? '—',
        numero_tarima: rel.numero_tarima, cantidad: rel.cantidad, cliente: rel.cliente,
      })),
    }))
    return {
      tipo: 'LPT',
      registro: { ...lpt, lr_codigo: lpt.m48_lotes_recepcion?.codigo ?? null, lc_codigo: lpt.m48_lotes_compuestos?.codigo ?? null },
      origen,
      folios,
    }
  }

  if (cod.startsWith('LC-')) {
    const { data: lc } = await tbl('m48_lotes_compuestos')
      .select('*, m48_lc_lr(lr_id, m48_lotes_recepcion(id,codigo,proveedor_nombre,fecha,cantidad,unidad))')
      .eq('codigo', cod).eq('org_id', orgId).maybeSingle()
    if (!lc) return null
    const lrs = ((lc.m48_lc_lr ?? []) as any[]).map((rel: any) => ({ ...rel.m48_lotes_recepcion, rancho_nombre: '—' }))
    const { data: lpts } = await tbl('m48_lotes_producto')
      .select('*, m48_lotes_compuestos(codigo)').eq('lc_id', lc.id).eq('org_id', orgId)
    return {
      tipo: 'LC',
      registro: { ...lc, lotes_recepcion: lrs },
      lrs,
      lpts: ((lpts ?? []) as any[]).map((r: any) => ({ ...r, lr_codigo: null, lc_codigo: r.m48_lotes_compuestos?.codigo ?? null })),
    }
  }

  if (cod.startsWith('FE-')) {
    const { data: fe } = await tbl('m48_folios_embarque')
      .select('*, m48_fe_lpt(lpt_id, numero_tarima, cantidad, cliente, m48_lotes_producto(id, codigo, fecha_empaque, turno, presentacion, cant_empacada, lr_id, lc_id, m48_lotes_recepcion(codigo), m48_lotes_compuestos(codigo)))')
      .eq('codigo', cod).eq('org_id', orgId).maybeSingle()
    if (!fe) return null
    const lptsDeFe = ((fe.m48_fe_lpt ?? []) as any[]).map((rel: any) => ({
      lpt_id: rel.lpt_id, lpt_codigo: rel.m48_lotes_producto?.codigo ?? '—',
      numero_tarima: rel.numero_tarima, cantidad: rel.cantidad, cliente: rel.cliente,
      lpt: { ...rel.m48_lotes_producto, lr_codigo: rel.m48_lotes_producto?.m48_lotes_recepcion?.codigo ?? null, lc_codigo: rel.m48_lotes_producto?.m48_lotes_compuestos?.codigo ?? null },
    }))
    return { tipo: 'FE', registro: { ...fe, lotes_producto: lptsDeFe.map(r => ({ lpt_id: r.lpt_id, lpt_codigo: r.lpt_codigo, numero_tarima: r.numero_tarima, cantidad: r.cantidad, cliente: r.cliente })) }, lptsDeFe }
  }

  return null
}
