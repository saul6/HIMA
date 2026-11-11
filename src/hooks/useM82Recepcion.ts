// M82 · Recepción diaria de fruta por ítem: catálogo por organización, entregas y líneas.
// El bloque de la hoja y ORG/CONV los resuelve la BD desde el código del ítem (trigger); el front nunca los manda.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

const tbl = (name: string) => (supabase as any).from(name)

export type M82Estado = 'PRECAPTURA' | 'ACEPTADA' | 'RECHAZADA' | 'RETENIDA'

export interface M82Bloque {
  id: string
  clave: string
  titulo: string
  pagina: number
  posicion: 'completa' | 'izquierda' | 'derecha'
  max_columnas: number
  max_renglones: number
  orden: number
  fruta?: string | null
}

export interface M82Item {
  id: string
  bloque_id: string
  codigo: string
  presentacion: string
  clasificacion: 'ORG' | 'CONV'
  orden: number
}

export interface M82Linea {
  id: string
  entrega_id: string
  codigo: string
  bloque_clave: string | null
  clasificacion: 'ORG' | 'CONV' | null
  cajas_declaradas: number
  cajas_confirmadas: number | null
  orden: number
}

export interface M82Entrega {
  id: string
  org_id: string
  rancho_id: string
  fecha: string
  hora: string
  empresa: string
  codigo_productor: string
  estado: M82Estado
  pase_anden: boolean
  limp_be: boolean | null
  limp_l: boolean | null
  limp_lp: boolean | null
  observaciones: string | null
  creado_por: string | null
  confirmado_en: string | null
  rancho_nombre: string
  lineas: M82Linea[]
}

export function useM82Catalogo() {
  const { profile } = useAuthContext()
  const orgId = profile?.org_id ?? null
  const [bloques, setBloques] = useState<M82Bloque[]>([])
  const [items, setItems] = useState<M82Item[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) return
    let vivo = true
    ;(async () => {
      setLoading(true)
      const [b, i] = await Promise.all([
        tbl('m82_bloques').select('*').eq('org_id', orgId).order('orden'),
        tbl('m82_items_catalogo').select('id, bloque_id, codigo, presentacion, clasificacion, orden').eq('org_id', orgId).eq('activo', true).order('orden'),
      ])
      if (!vivo) return
      const bl: M82Bloque[] = b.data ?? []
      const ordenBloque = new Map(bl.map(x => [x.id, x.orden]))
      const it: M82Item[] = (i.data ?? []).slice().sort((x: M82Item, y: M82Item) =>
        (ordenBloque.get(x.bloque_id) ?? 0) - (ordenBloque.get(y.bloque_id) ?? 0) || x.orden - y.orden)
      setBloques(bl)
      setItems(it)
      setLoading(false)
    })()
    return () => { vivo = false }
  }, [orgId])

  return { bloques, items, loading }
}

export async function cargarEntregasM82(orgId: string, fecha: string): Promise<M82Entrega[]> {
  const { data, error } = await tbl('m82_entregas')
    .select('*, ranchos(nombre), m82_entrega_lineas(*)')
    .eq('org_id', orgId)
    .eq('fecha', fecha)
    .order('hora')
  if (error) throw error
  return (data ?? []).map((e: any) => ({
    ...e,
    hora: String(e.hora ?? '').slice(0, 5),
    rancho_nombre: e.ranchos?.nombre ?? '—',
    lineas: ((e.m82_entrega_lineas ?? []) as M82Linea[]).slice().sort((a, b) => a.orden - b.orden),
  }))
}

export function useM82Entregas(fecha: string) {
  const { profile } = useAuthContext()
  const orgId = profile?.org_id ?? null
  const [entregas, setEntregas] = useState<M82Entrega[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      setEntregas(await cargarEntregasM82(orgId, fecha))
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [orgId, fecha])

  useEffect(() => { refetch() }, [refetch])

  return { entregas, loading, error, refetch }
}

export interface NuevaEntregaM82 {
  orgId: string
  rancho_id: string
  fecha: string
  hora: string
  empresa: string
  codigo_productor: string
  lineas: { codigo: string; cajas: number }[]
}

/** Crea la entrega en precaptura y sus líneas. Si las líneas fallan, borra la entrega (sigue en precaptura). */
export async function crearEntregaM82(n: NuevaEntregaM82): Promise<string> {
  const { data, error } = await tbl('m82_entregas').insert({
    org_id: n.orgId,
    rancho_id: n.rancho_id,
    fecha: n.fecha,
    hora: n.hora,
    empresa: n.empresa.trim(),
    codigo_productor: n.codigo_productor.trim(),
  }).select('id').single()
  if (error) throw error
  const id: string = data.id
  const { error: e2 } = await tbl('m82_entrega_lineas').insert(
    n.lineas.map((l, i) => ({ org_id: n.orgId, entrega_id: id, codigo: l.codigo, cajas_declaradas: l.cajas, orden: i + 1 })),
  )
  if (e2) {
    await tbl('m82_entregas').delete().eq('id', id)
    throw e2
  }
  return id
}

export interface DictamenM82 {
  estado: Exclude<M82Estado, 'PRECAPTURA'>
  cajas: Record<string, number>   // linea_id -> cajas físicas
  limp_be: boolean | null
  limp_l: boolean | null
  limp_lp: boolean | null
  pase_anden: boolean
  observaciones: string
}

/** Guarda cajas físicas y verificación del vehículo; al final cambia el estado (la BD valida la transición). */
export async function dictaminarEntregaM82(entrega: M82Entrega, d: DictamenM82): Promise<void> {
  for (const l of entrega.lineas) {
    const c = d.cajas[l.id]
    if (c == null || c === l.cajas_confirmadas) continue
    const { error } = await tbl('m82_entrega_lineas').update({ cajas_confirmadas: c }).eq('id', l.id)
    if (error) throw error
  }
  const { error: e1 } = await tbl('m82_entregas').update({
    limp_be: d.limp_be,
    limp_l: d.limp_l,
    limp_lp: d.limp_lp,
    pase_anden: d.pase_anden,
    observaciones: d.observaciones.trim() || null,
  }).eq('id', entrega.id)
  if (e1) throw e1
  const { error: e2 } = await tbl('m82_entregas').update({ estado: d.estado }).eq('id', entrega.id)
  if (e2) throw e2
}

export async function borrarEntregaM82(id: string): Promise<void> {
  const { error } = await tbl('m82_entregas').delete().eq('id', id).eq('estado', 'PRECAPTURA')
  if (error) throw error
}

/** Traduce los errores del servidor a mensajes para el usuario. */
export function mensajeErrorM82(e: any): { tipo: 'warning' | 'error'; texto: string } {
  const msg: string = e?.message ?? String(e ?? '')
  const tabla: [string, 'warning' | 'error', string][] = [
    ['FECHA_SOLO_HOY', 'warning', 'Solo puedes registrar con la fecha de hoy'],
    ['M82_ITEM_DESCONOCIDO', 'error', 'Ese ítem no está en el catálogo'],
    ['M82_VEHICULO_SIN_VERIFICAR', 'warning', 'Marca BE, L y LP antes de aceptar'],
    ['M82_PLAGA', 'error', 'Con presencia de plaga la carga no se recibe'],
    ['M82_CAJAS_SIN_CONFIRMAR', 'warning', 'Confirma las cajas físicas de cada ítem'],
    ['M82_SIN_ITEMS', 'warning', 'Agrega al menos un ítem'],
    ['M82_ENTREGA_CERRADA', 'warning', 'La entrega ya tiene dictamen; solo se editan observaciones'],
    ['M82_PAPELETA_ABIERTA', 'warning', 'La entrega tiene papeletas de no conforme sin dictamen; dictamínalas en Producto No Conforme'],
    ['M82_TRANSICION', 'warning', 'Ese cambio de estado no está permitido'],
    ['FIRMA_REQUERIDA', 'warning', 'Registra tu firma en tu perfil antes de capturar'],
  ]
  for (const [clave, tipo, texto] of tabla) if (msg.includes(clave)) return { tipo, texto }
  if (msg.includes('TEXTO_MUY_LARGO')) return { tipo: 'warning', texto: msg.replace(/^.*TEXTO_MUY_LARGO:\s*/, '') }
  if (msg.includes('row-level security')) return { tipo: 'error', texto: 'No tienes permiso para esta instalación' }
  return { tipo: 'error', texto: msg || 'Error al guardar' }
}
