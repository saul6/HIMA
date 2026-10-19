import { supabase } from '@/lib/supabase'
import { leerConCache } from './cacheLectura'

// Precarga en segundo plano de las listas recientes de los módulos offline que no
// tenían precarga propia, para que abran sin red aunque nunca se hayan visitado.
// Cada consulta replica la de su hook/pantalla (misma clave de caché).
// Ligero: sin fotos ni binarios.

const db = supabase as any

type Fetcher = () => Promise<unknown>

function lista(tabla: string, select: string, orden: Array<[string, boolean]>, orgId: string, limite?: number): Fetcher {
  return async () => {
    let q = db.from(tabla).select(select).eq('org_id', orgId)
    for (const [col, asc] of orden) q = q.order(col, { ascending: asc })
    if (limite) q = q.limit(limite)
    const { data, error } = await q
    if (error) throw error
    return data ?? []
  }
}

function catalogo(tabla: string, select: string, orden: string, soloActivos: boolean): Fetcher {
  return async () => {
    let q = db.from(tabla).select(select)
    if (soloActivos) q = q.eq('activo', true)
    const { data } = await q.order(orden)
    return data ?? []
  }
}

// Familia de limpiezas mensuales (M28–M35, M37): items por rancho + detalle de cada registro reciente.
const FAMILIA_LIMPIEZA: Array<{ n: number; itemsCols: string; resCols: string }> = [
  { n: 28, itemsCols: 'id, nombre, frecuencia, activo, orden', resCols: 'item_id, dia, valor' },
  { n: 29, itemsCols: 'id, nombre, frecuencia, activo, orden', resCols: 'item_id, dia, valor' },
  { n: 30, itemsCols: 'id, nombre, frecuencia, activo, orden', resCols: 'item_id, dia, valor' },
  { n: 31, itemsCols: 'id, nombre, frecuencia, activo, orden', resCols: 'item_id, dia, valor' },
  { n: 32, itemsCols: 'id, nombre, frecuencia, activo, orden', resCols: 'item_id, dia, valor' },
  { n: 33, itemsCols: 'id, nombre, frecuencia, activo, orden', resCols: 'item_id, dia, valor' },
  { n: 34, itemsCols: 'id, nombre, frecuencia, es_inspeccion_plaga, activo, orden', resCols: 'item_id, dia, valor, incidencia_id' },
  { n: 35, itemsCols: 'id, nombre, frecuencia, genera_incidencia, activo, orden', resCols: 'item_id, dia, valor, incidencia_id' },
  { n: 37, itemsCols: 'id, nombre, frecuencia, es_inspeccion_plaga, activo, orden', resCols: 'item_id, dia, valor, incidencia_id' },
]

const MESES_DETALLE = 2 // registros de los últimos N meses

export async function precargarListasRecientes(userId: string, orgId: string, codigos?: Set<string>): Promise<void> {
  if (!navigator.onLine) return
  const quiere = (codigo: string) => !codigos || codigos.size === 0 || codigos.has(codigo)
  const tareas: Array<Promise<unknown>> = []
  const cache = (clave: string, fetcher: Fetcher) => {
    tareas.push(leerConCache(clave, userId, orgId, fetcher))
  }

  if (quiere('M6')) {
    cache('m6_botiquin', lista('m6_botiquin', '*, ranchos(nombre, codigo), creador:profiles!creado_por(nombre_completo)', [['fecha_verificacion', false]], orgId, 100))
  }
  if (quiere('M7')) {
    cache('m7_vidrio_plastico', lista('m7_vidrio_plastico', '*, ranchos(nombre, codigo)', [['fecha', false], ['created_at', true]], orgId, 500))
  }
  if (quiere('M10')) {
    cache('m10_cosecha_liberacion', lista('m10_cosecha_liberacion', '*, ranchos(nombre, codigo), encargado:profiles!encargado_liberacion_id(nombre_completo)', [['fecha', false], ['created_at', true]], orgId, 500))
  }
  if (quiere('M11')) {
    cache('m11_registros', lista('m11_registro_mensual', '*, ranchos(nombre, codigo)', [['mes', false], ['created_at', false]], orgId))
    cache('m11_items_catalogo', catalogo('m11_items_catalogo', '*', 'orden', false))
  }
  if (quiere('M19')) {
    cache('m19_registros', lista('m19_registro_mensual', '*, ranchos(nombre, codigo)', [['mes', false], ['created_at', false]], orgId))
    cache('m19_items_catalogo', catalogo('m19_items_catalogo', '*', 'orden', false))
  }
  if (quiere('M22')) {
    cache('m22_muestras', lista('m22_muestras', '*, ranchos(nombre)', [['fecha_muestreo', false], ['created_at', false]], orgId))
  }
  if (quiere('M23')) {
    cache('m23_registros', lista('m23_registro_mensual', '*, ranchos(nombre, codigo)', [['mes', false], ['created_at', false]], orgId))
  }
  if (quiere('M27')) {
    cache('m27_preparaciones', lista('m27_preparaciones', '*, ranchos(nombre)', [['fecha', false], ['created_at', false]], orgId, 500))
  }
  if (quiere('M36')) {
    cache('m36_monitoreos', lista('m36_monitoreos', '*, ranchos(nombre)', [['fecha', false], ['created_at', false]], orgId))
  }
  if (quiere('M43')) {
    cache('m43_registros', async () => {
      const { data, error } = await db
        .from('m43_registro_mensual')
        .select(`
          id, org_id, rancho_id, anio, mes, realizado_por, verifica, autoriza, observaciones,
          ranchos(nombre, codigo),
          m43_dias(id, dia, acciones_tomadas),
          m43_resultados(id, punto_id, dia, valor, incidencia_id)
        `)
        .eq('org_id', orgId)
        .order('anio', { ascending: false })
        .order('mes', { ascending: false })
      if (error) throw error
      return data ?? []
    })
    cache('m43_puntos', async () => {
      const { data } = await db.from('m43_puntos').select('id, orden, texto').order('orden')
      return data ?? []
    })
  }
  if (quiere('M45')) {
    cache('m45_registros', lista('m45_registro_mensual', 'id, org_id, rancho_id, anio, mes, observaciones, ranchos(nombre, codigo)', [['anio', false], ['mes', false]], orgId))
    cache('m45_items', async () => {
      const { data } = await db.from('m45_items').select('id, area, nombre, frecuencia, orden').eq('activo', true).order('area').order('orden')
      return data ?? []
    })
  }
  for (const [n, tabla, cols] of [[69, 'm69', 'id, seccion, numero, texto'], [71, 'm71', 'id, seccion, numero, texto'], [75, 'm75', 'id, numero, texto']] as const) {
    if (!quiere(`M${n}`)) continue
    cache(`${tabla}_registros`, lista(`${tabla}_registro`, '*, ranchos(nombre)', [['mes', false], ['created_at', false]], orgId))
    cache(`${tabla}_items_catalogo`, catalogo(`${tabla}_items_catalogo`, cols, 'numero', true))
  }

  await Promise.allSettled(tareas)

  // Limpiezas mensuales: items por rancho y detalle de los registros recientes
  const activas = FAMILIA_LIMPIEZA.filter((f) => quiere(`M${f.n}`))
  if (activas.length === 0) return
  const { data: ranchos } = await db.from('ranchos').select('id').eq('org_id', orgId).eq('activo', true)
  const hoy = new Date()
  const limite = hoy.getFullYear() * 12 + hoy.getMonth() - MESES_DETALLE
  await Promise.allSettled(activas.map(async ({ n, itemsCols, resCols }) => {
    const p = `m${n}`
    const sub: Array<Promise<unknown>> = (ranchos ?? []).map((r: { id: string }) =>
      leerConCache(`${p}_items_${r.id}`, userId, orgId, async () => {
        const { data } = await db.from(`${p}_items`).select(itemsCols).eq('org_id', orgId).eq('rancho_id', r.id).order('orden')
        return data ?? []
      }))
    const { data: regs } = await db.from(`${p}_registro_mensual`).select('id, anio, mes').eq('org_id', orgId)
      .order('anio', { ascending: false }).order('mes', { ascending: false }).limit(60)
    for (const reg of (regs ?? []) as Array<{ id: string; anio: number; mes: number }>) {
      if (reg.anio * 12 + (reg.mes - 1) < limite) continue
      sub.push(leerConCache(`${p}_detalle_${reg.id}`, userId, orgId, async () => {
        const [resultadosRes, diasRes] = await Promise.all([
          db.from(`${p}_resultados`).select(resCols).eq('registro_id', reg.id).eq('org_id', orgId),
          db.from(`${p}_dias`).select('*').eq('registro_id', reg.id),
        ])
        if (resultadosRes.error) throw resultadosRes.error
        if (diasRes.error) throw diasRes.error
        return { resultados: resultadosRes.data ?? [], dias: diasRes.data ?? [] }
      }))
    }
    await Promise.allSettled(sub)
  }))
}
