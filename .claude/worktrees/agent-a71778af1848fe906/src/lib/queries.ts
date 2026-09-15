import { supabase } from '@/lib/supabase'
import type {
  Aplicacion,
  AplicacionConProductos,
  AplicacionInsert,
  AplicacionProductoInsert,
  AplicacionRica,
  AplicacionUpdate,
  InventarioMovimiento,
  InventarioSaldoRancho,
  InventarioSaldoProductor,
  Organizacion,
  Rancho,
  RanchoInsert,
  RanchoUpdate,
  TipoMovimiento,
} from '@/types/database.types'

export type MovimientoConRancho = InventarioMovimiento & { ranchos: { nombre: string } }

// ── Organizaciones ───────────────────────────────────────────────────────────

export async function getOrganizacion(orgId: string): Promise<Organizacion> {
  const { data, error } = await supabase
    .from('organizaciones')
    .select('*')
    .eq('id', orgId)
    .single()
  if (error) throw error
  return data
}

export async function marcarCorreccion(
  tabla: string,
  registroId: string,
  requiere: boolean,
  comentario: string,
): Promise<void> {
  const { error } = await supabase.rpc('marcar_correccion', {
    p_tabla: tabla,
    p_registro_id: registroId,
    p_requiere: requiere,
    p_comentario: comentario,
  })
  if (error) throw error
}

export async function actualizarAdminEditaAjenos(
  orgId: string,
  valor: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('organizaciones')
    .update({ admin_edita_ajenos: valor })
    .eq('id', orgId)
  if (error) throw error
}

// ── Ranchos ──────────────────────────────────────────────────────────────────

export async function crearRancho(datos: RanchoInsert): Promise<Rancho> {
  const { data, error } = await supabase
    .from('ranchos')
    .insert(datos)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function actualizarRancho(id: string, datos: RanchoUpdate): Promise<Rancho> {
  const { data, error } = await supabase
    .from('ranchos')
    .update({ ...datos, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function desactivarRancho(id: string): Promise<void> {
  const { error } = await supabase
    .from('ranchos')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function getRanchos(productorId?: string): Promise<Rancho[]> {
  let query = supabase
    .from('ranchos')
    .select('*')
    .eq('activo', true)
    .order('nombre')

  if (productorId) {
    query = query.eq('productor_id', productorId)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

// ── Aplicaciones ─────────────────────────────────────────────────────────────

export async function getAplicaciones(productorId?: string): Promise<Aplicacion[]> {
  let query = supabase
    .from('aplicaciones')
    .select('*')
    .order('fecha_aplicacion', { ascending: false })

  if (productorId) {
    query = query.eq('productor_id', productorId)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getAplicacionById(id: string): Promise<AplicacionConProductos> {
  const { data, error } = await supabase
    .from('aplicaciones')
    .select(`
      *,
      aplicacion_productos (
        *,
        catalogo_productos (*)
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as AplicacionConProductos
}

export async function crearAplicacion(datos: AplicacionInsert): Promise<Aplicacion> {
  const { data, error } = await supabase
    .from('aplicaciones')
    .insert(datos)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function insertarProductosAplicacion(
  aplicacionId: string,
  productos: Omit<AplicacionProductoInsert, 'aplicacion_id' | 'org_id'>[],
  orgId: string,
): Promise<void> {
  if (productos.length === 0) return
  const rows: AplicacionProductoInsert[] = productos.map((p) => ({
    ...p,
    aplicacion_id: aplicacionId,
    org_id: orgId,
  }))
  const { error } = await supabase.from('aplicacion_productos').insert(rows)
  if (error) throw error
}

const APLICACION_RICA_SELECT = `
  *,
  ranchos (*),
  productores!productor_id (
    id,
    profile_id,
    profiles!profile_id (nombre_completo)
  ),
  asesor:profiles!asesor_id (nombre_completo),
  responsable:profiles!responsable_inocuidad_id (nombre_completo),
  aplicacion_productos (
    *,
    catalogo_productos (*)
  )
` as const

export async function getAplicacionesRicas(productorId?: string): Promise<AplicacionRica[]> {
  let query = supabase
    .from('aplicaciones')
    .select(APLICACION_RICA_SELECT)
    .order('fecha_aplicacion', { ascending: false })

  if (productorId) {
    query = query.eq('productor_id', productorId)
  }

  const { data, error } = await query
  if (error) throw error
  return data as unknown as AplicacionRica[]
}

export async function getAplicacionRicaById(id: string): Promise<AplicacionRica> {
  const { data, error } = await supabase
    .from('aplicaciones')
    .select(APLICACION_RICA_SELECT)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as unknown as AplicacionRica
}

export async function actualizarAplicacion(
  id: string,
  datos: AplicacionUpdate
): Promise<Aplicacion> {
  const { data, error } = await supabase
    .from('aplicaciones')
    .update(datos)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// ── Perfil ────────────────────────────────────────────────────────────────────

export async function actualizarNombreCompleto(
  userId: string,
  nombreCompleto: string,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ nombre_completo: nombreCompleto, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw error
}

// ── Inventario ────────────────────────────────────────────────────────────────

export async function getSaldosRancho(productorId: string): Promise<InventarioSaldoRancho[]> {
  const { data, error } = await supabase
    .from('v_inventario_saldo_rancho')
    .select('*')
    .eq('productor_id', productorId)
    .order('nombre_comercial')
  if (error) throw error
  return (data ?? []) as InventarioSaldoRancho[]
}

export async function getSaldosProductor(productorId: string): Promise<InventarioSaldoProductor[]> {
  const { data, error } = await supabase
    .from('v_inventario_saldo_productor')
    .select('*')
    .eq('productor_id', productorId)
    .order('nombre_comercial')
  if (error) throw error
  return (data ?? []) as InventarioSaldoProductor[]
}

export async function getMovimientosProducto(
  productoId: string,
  ranchoId?: string,
): Promise<MovimientoConRancho[]> {
  let query = supabase
    .from('inventario_movimientos')
    .select('*, ranchos(nombre)')
    .eq('producto_id', productoId)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50) as ReturnType<typeof supabase.from>

  if (ranchoId) query = (query as any).eq('rancho_id', ranchoId)

  const { data, error } = await (query as any)
  if (error) throw error
  return (data ?? []) as MovimientoConRancho[]
}

export async function getSaldoActual(ranchoId: string, productoId: string): Promise<number> {
  const { data, error } = await supabase.rpc('saldo_inventario', {
    p_rancho_id: ranchoId,
    p_producto_id: productoId,
  })
  if (error) throw error
  return Number(data) ?? 0
}

export async function registrarMovimiento(mov: {
  rancho_id: string
  producto_id: string
  tipo: TipoMovimiento
  cantidad: number
  fecha: string
  org_id: string
  referencia?: string | null
  notas?: string | null
  registrado_por: string
}): Promise<void> {
  const saldoActual = await getSaldoActual(mov.rancho_id, mov.producto_id)
  if (mov.tipo === 'salida' && saldoActual < mov.cantidad) {
    throw new Error(`Stock insuficiente. Disponible: ${saldoActual}`)
  }
  const delta = mov.tipo === 'salida' ? -mov.cantidad : mov.cantidad
  const balance = saldoActual + delta
  const { error } = await supabase.from('inventario_movimientos').insert({
    rancho_id: mov.rancho_id,
    producto_id: mov.producto_id,
    tipo: mov.tipo,
    cantidad: mov.cantidad,
    balance,
    referencia: mov.referencia ?? null,
    notas: mov.notas ?? null,
    fecha: mov.fecha,
    registrado_por: mov.registrado_por,
    org_id: mov.org_id,
  })
  if (error) throw error
}

export async function registrarSalidasAplicacion(
  aplicacionId: string,
  ranchoId: string,
  productos: Array<{ productId: string; totalProduct: string }>,
  registradoPor: string,
  fecha: string,
  orgId: string,
): Promise<void> {
  for (const p of productos) {
    const cantidad = parseFloat(p.totalProduct)
    if (!cantidad || cantidad <= 0) continue
    try {
      const saldoActual = await getSaldoActual(ranchoId, p.productId)
      const balance = saldoActual - cantidad
      const { error } = await supabase.from('inventario_movimientos').insert({
        rancho_id: ranchoId,
        producto_id: p.productId,
        tipo: 'salida' as TipoMovimiento,
        cantidad,
        balance,
        aplicacion_id: aplicacionId,
        fecha,
        registrado_por: registradoPor,
        org_id: orgId,
      })
      if (error) console.warn(`[inv] insert error ${p.productId}:`, error.message)
    } catch (err) {
      console.warn(`[inv] salida fallida ${p.productId}:`, err)
    }
  }
}
