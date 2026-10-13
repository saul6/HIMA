import { createContext, useContext, useEffect, useCallback, type ReactNode } from 'react'
import { useMisModulos, type ModuloVisible } from '@/hooks/useMisModulos'
import { useTerminoSitio, resolverTerminos, type TerminosSitio } from '@/hooks/useTerminoSitio'
import { useAuthContext } from '@/context/AuthContext'
import { precargarCache, leerConCache } from '@/lib/offline/cacheLectura'
import { supabase } from '@/lib/supabase'
import { getRanchos } from '@/lib/queries'
import { fetchCatalogoProductos } from '@/hooks/useCatalogoProductos'
import { fetchSaldosInventario } from '@/lib/offline/saldosInventario'
import { fetchEstacionesOrg, fetchNfcActivo, CLAVE_ESTACIONES_ORG, CLAVE_NFC_ACTIVO } from '@/lib/offline/resolverNfcOffline'
import { claveCacheEstaciones } from '@/hooks/useM21EstacionesRancho'

interface ModulosContextValue {
  modulos: ModuloVisible[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  terminosSitio: TerminosSitio
  desdeCache: boolean
  guardadoEn: number | null
}

const ModulosContext = createContext<ModulosContextValue | null>(null)

export function ModulosProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading } = useAuthContext()
  const userId = user?.id
  const orgId  = profile?.org_id ?? undefined

  const {
    modulos, loading: modulosLoading, error, refetch, clear,
    desdeCache, guardadoEn,
  } = useMisModulos(userId, orgId)
  const { termino, refetch: refetchTermino, clear: clearTermino } = useTerminoSitio(userId, orgId)

  useEffect(() => {
    if (authLoading) return
    if (user) {
      refetch()
      refetchTermino()
    } else {
      clear()
      clearTermino()
    }
  }, [user?.id, authLoading, refetch, clear, refetchTermino, clearTermino])

  // Precarga en segundo plano todos los recursos necesarios para trabajar sin red
  const ejecutarPrecarga = useCallback(async () => {
    if (!userId || !orgId || !navigator.onLine) return
    await precargarCache(userId, orgId, [
      {
        clave: 'termino_sitio',
        fetcher: async () => {
          const { data } = await supabase.rpc('get_mi_termino_sitio')
          return (data as string) ?? 'Rancho'
        },
      },
      {
        clave: 'ranchos',
        fetcher: () => getRanchos(),
      },
      {
        clave: 'm9_items_catalogo',
        fetcher: async () => {
          const { data } = await supabase
            .from('m9_items_catalogo')
            .select('*')
            .order('orden')
          return data ?? []
        },
      },
      {
        clave: 'm9_registros',
        fetcher: async () => {
          const { data } = await supabase
            .from('m9_registro_mensual')
            .select('*, ranchos(nombre, codigo)')
            .eq('org_id', orgId)
            .order('mes', { ascending: false })
            .order('created_at', { ascending: false })
          return data ?? []
        },
      },
      {
        clave: 'm12_jornadas',
        fetcher: async () => {
          const { data } = await supabase
            .from('m12_limpieza_banos')
            .select('*, ranchos(nombre, codigo)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(500)
          return data ?? []
        },
      },
      {
        clave: 'm13_reportes',
        fetcher: async () => {
          const { data } = await supabase
            .from('m13_reportes')
            .select(`*, ranchos(nombre, codigo), creador:profiles!creado_por(nombre_completo), m13_incidencias(id, orden, descripcion, m13_incidencia_fotos(id, storage_path, orden))`)
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(100)
          return data ?? []
        },
      },
      {
        clave: 'm22_microorganismos',
        fetcher: async () => {
          const { data } = await supabase
            .from('m22_microorganismos')
            .select('*')
            .order('tipo')
            .order('orden')
          return data ?? []
        },
      },
      {
        clave: 'profiles_org',
        fetcher: async () => {
          const { data } = await supabase
            .from('profiles')
            .select('id, nombre_completo')
            .eq('org_id', orgId)
            .eq('activo', true)
            .order('nombre_completo')
          return data ?? []
        },
      },
      {
        clave: `org_nombre:${orgId}`,
        fetcher: async () => {
          const { data, error } = await supabase.from('organizaciones').select('nombre').eq('id', orgId).single()
          if (error || !data) throw error ?? new Error('Organización no encontrada')
          return data.nombre as string
        },
      },
      {
        clave: 'm20_accidentes',
        fetcher: async () => {
          const { data } = await (supabase as any)
            .from('m20_accidentes')
            .select('*, ranchos(nombre, codigo), m20_accidente_fotos(id, storage_path, orden)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          return data ?? []
        },
      },
      ...(['m49_calibracion_bombas', 'm50_calibracion_equipos', 'm51_calibracion_basculas', 'm52_calibracion_volumetricos'] as const).map(tabla => ({
        clave: tabla,
        fetcher: async () => {
          const { data } = await (supabase as any)
            .from(tabla)
            .select('*, ranchos(nombre)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          return data ?? []
        },
      })),
      // Bloque 1 (cabecera + resultados): lista de registros y catálogo de ítems
      ...([['m53', 'texto'], ['m54', 'texto'], ['m55', 'texto'], ['m59', 'descripcion']] as const).flatMap(([m, campo]) => [
        {
          clave: `${m}_registro`,
          fetcher: async () => {
            const { data } = await (supabase as any)
              .from(`${m}_registro`)
              .select('*, ranchos(nombre)')
              .eq('org_id', orgId)
              .order('fecha', { ascending: false })
              .order('created_at', { ascending: false })
            return data ?? []
          },
        },
        {
          clave: `${m}_items_catalogo`,
          fetcher: async () => {
            const { data } = await (supabase as any)
              .from(`${m}_items_catalogo`)
              .select(`id, numero, ${campo}`)
              .eq('activo', true)
              .order('numero', { ascending: true })
            return data ?? []
          },
        },
      ]),
      // M62, M68, M72: lista de registros y catálogo (misma consulta que su hook)
      ...([
        ['m62_registro', 'm62_items_catalogo', 'id, numero, descripcion', false, [['numero']]],
        ['m68_roedores_registro', 'm68_roedores_criterios', 'id, numero, descripcion', true, [['numero']]],
        ['m72_registro', 'm72_organismos', 'id, tipo, nombre', true, [['tipo'], ['nombre']]],
      ] as const).flatMap(([reg, cat, cols, soloActivos, orden]) => [
        {
          clave: reg,
          fetcher: async () => {
            const { data } = await (supabase as any)
              .from(reg)
              .select('*, ranchos(nombre)')
              .eq('org_id', orgId)
              .order('fecha', { ascending: false })
              .order('created_at', { ascending: false })
            return data ?? []
          },
        },
        {
          clave: cat,
          fetcher: async () => {
            let q = (supabase as any).from(cat).select(cols)
            if (soloActivos) q = q.eq('activo', true)
            for (const [col] of orden) q = q.order(col, { ascending: true })
            const { data } = await q
            return data ?? []
          },
        },
      ]),
      // M70, M73, M78: lista de registros (misma consulta que su hook) y catálogo de M73
      {
        clave: 'm70_verificacion_roedores',
        fetcher: async () => {
          const { data } = await (supabase as any)
            .from('m70_verificacion_roedores')
            .select('*, ranchos(nombre)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          return data ?? []
        },
      },
      {
        clave: 'm73_registro',
        fetcher: async () => {
          const { data } = await (supabase as any)
            .from('m73_registro')
            .select('*, ranchos(nombre), m73_resultados(count)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          return data ?? []
        },
      },
      {
        clave: 'm73_botiquin_catalogo',
        fetcher: async () => {
          const { data } = await (supabase as any)
            .from('m73_botiquin_catalogo')
            .select('id, nombre')
            .eq('activo', true)
            .order('orden')
          return data ?? []
        },
      },
      {
        clave: 'm78_nota_trazabilidad',
        fetcher: async () => {
          const { data } = await (supabase as any)
            .from('m78_nota_trazabilidad')
            .select('*, ranchos(nombre)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          return data ?? []
        },
      },
      {
        clave: 'm41_registros',
        fetcher: async () => {
          const { data } = await (supabase as any)
            .from('m41_registros')
            .select('id, rancho_id, fecha, temp_min, temp_max, ranchos(nombre), m41_lecturas(hora, temperatura, incidencia_id)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          return data ?? []
        },
      },
      {
        clave: 'catalogo_productos',
        fetcher: fetchCatalogoProductos,
        omitirSiMenorA: 12 * 60 * 60 * 1000,
      },
      {
        clave: 'inv_saldos',
        fetcher: fetchSaldosInventario,
      },
      {
        clave: 'm8_registros',
        fetcher: async () => {
          const { data } = await supabase
            .from('m8_fertilizacion')
            .select('*, ranchos(nombre, codigo)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(500)
          return data ?? []
        },
      },
      {
        clave: 'fertilizantes_org',
        fetcher: async () => {
          const { data } = await supabase
            .from('fertilizantes_org')
            .select('id, nombre_comercial, ingrediente_activo, concentracion, unidad')
            .eq('org_id', orgId)
            .eq('activo', true)
            .order('nombre_comercial')
          return data ?? []
        },
      },
      {
        clave: 'inv_fertilizantes_saldo',
        fetcher: async () => {
          const { data } = await supabase
            .from('v_inventario_fertilizantes_saldo')
            .select('rancho_id, rancho_nombre, fertilizante_id, nombre_comercial, ingrediente_activo, unidad, saldo')
            .eq('org_id', orgId)
            .order('nombre_comercial')
            .order('rancho_nombre')
          return data ?? []
        },
      },
      {
        clave: 'm39_recepciones',
        fetcher: async () => {
          const { data } = await (supabase as any)
            .from('m39_recepciones')
            .select('id, rancho_id, fecha, empresa, hoja_no, ranchos(nombre), m39_lineas(cant_6oz, cant_12oz, cant_18oz, cajas, piezas)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          return data ?? []
        },
      },
      {
        clave: 'm40_registros',
        fetcher: async () => {
          const { data } = await (supabase as any)
            .from('m40_registros')
            .select('id, rancho_id, fecha, empresa, ranchos(nombre)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          return data ?? []
        },
      },
      {
        clave: 'm38_manifiestos',
        fetcher: async () => {
          const { data } = await (supabase as any)
            .from('m38_manifiestos')
            .select('id, rancho_id, fecha, folio, empresa, nombre_chofer, incidencia_id, ranchos(nombre)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          return data ?? []
        },
      },
      {
        clave: 'm42_movimientos',
        fetcher: async () => {
          const { data } = await (supabase as any)
            .from('m42_movimientos')
            .select('id, rancho_id, fecha, empresa, descripcion_material, entrada, salida, total, mat_libre_plagas, tr_libre_plagas, incidencia_id, ranchos(nombre)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          return data ?? []
        },
      },
      {
        clave: 'm44_ordenes',
        fetcher: async () => {
          const { data } = await (supabase as any)
            .from('m44_ordenes')
            .select(`
              id, rancho_id, fecha, folio, descripcion_solicitud, prioridad,
              solicita, recibe_mtto, equipo_produccion, lavado_sanitizado,
              observaciones, entrega_mtto, recibe, incidencia_id,
              ranchos(nombre, codigo)
            `)
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
          return data ?? []
        },
      },
      {
        clave: 'm46_rondines',
        fetcher: async () => {
          const { data } = await (supabase as any)
            .from('m46_rondines')
            .select('*, ranchos(nombre), m46_resultados(valor)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
          return data ?? []
        },
      },
      {
        clave: 'm47_trabajadores',
        fetcher: async () => {
          const { data } = await (supabase as any)
            .from('m47_trabajadores')
            .select('*, ranchos(nombre), m47_checklist(item_id, valor)')
            .eq('org_id', orgId)
            .order('nombre')
          return data ?? []
        },
      },
    ])

    // Precarga de días M9 para todos los registros del mes actual
    await precargarDiasM9(userId, orgId!)
    // Precarga de materiales M7 por rancho
    await precargarMaterialesM7(userId, orgId!)
    // Precarga de catálogos por sitio de M46 y M47
    await precargarItemsPorRancho(userId, orgId!)
    // Precarga de inventario de químicos M24 (saldos, catálogo por sitio, movimientos por químico)
    await precargarM24(userId, orgId!)
    // Precarga de auditorías internas M14–M18 (catálogo, lista y respuestas de borradores)
    await precargarAuditoriasInternas(userId, orgId!)
    // Precarga de M21 (estaciones con nfc_token, indicador NFC, catálogos y revisiones) para trabajar y escanear sin red
    await precargarM21(userId, orgId!)
    // Precarga de listas de trazabilidad M48 por sitio (LR, LPT, LC, FE)
    await precargarM48(userId, orgId!)
  }, [userId, orgId])

  async function precargarDiasM9(userId: string, orgId: string) {
    const mes = new Date().toISOString().slice(0, 7)
    const { data: registros } = await supabase
      .from('m9_registro_mensual')
      .select('id')
      .eq('org_id', orgId)
      .gte('mes', mes + '-01')
      .lte('mes', mes + '-28')
    if (!registros) return
    await Promise.allSettled(
      registros.map(reg =>
        leerConCache(
          `m9_dias:${reg.id}`,
          userId,
          orgId,
          async () => {
            const { data: diasData } = await supabase
              .from('m9_dias_inspeccion')
              .select('id, fecha')
              .eq('registro_id', reg.id)
              .eq('org_id', orgId)
              .order('fecha')
            const dias = diasData ?? []
            const diaIds = dias.map((d: any) => d.id)
            let resultados: any[] = []
            if (diaIds.length > 0) {
              const { data: r } = await supabase
                .from('m9_resultados')
                .select('dia_id, item_id, valor')
                .in('dia_id', diaIds)
                .eq('org_id', orgId)
              resultados = r ?? []
            }
            return { dias, resultados }
          },
          { maxEdad: 5 * 60 * 1000 },
        ),
      ),
    )
  }

  async function precargarMaterialesM7(userId: string, orgId: string) {
    const { data: ranchos } = await supabase
      .from('ranchos')
      .select('id')
      .eq('org_id', orgId)
      .eq('activo', true)
    if (!ranchos) return
    await Promise.allSettled(
      ranchos.map((r: any) =>
        leerConCache(
          `m7_materiales:${r.id}`,
          userId,
          orgId,
          async () => {
            const { data } = await supabase
              .from('m7_materiales_rancho')
              .select('id, area, material')
              .eq('org_id', orgId)
              .eq('rancho_id', r.id)
              .eq('activo', true)
              .order('area')
              .order('material')
            return data ?? []
          },
          { maxEdad: 10 * 60 * 1000 },
        ),
      ),
    )
  }

  async function precargarM48(userId: string, orgId: string) {
    const { data: ranchos } = await supabase
      .from('ranchos')
      .select('id')
      .eq('org_id', orgId)
      .eq('activo', true)
    if (!ranchos) return
    const sb = supabase as any
    const lista = async (tabla: string, select: string, ranchoId: string) => {
      const { data, error } = await sb.from(tabla).select(select).eq('org_id', orgId).eq('rancho_id', ranchoId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    }
    await Promise.allSettled(ranchos.flatMap((r: any) => [
      leerConCache(`m48_lr:${r.id}`, userId, orgId, async () =>
        (await lista('m48_lotes_recepcion', '*, ranchos(nombre)', r.id))
          .map((x: any) => ({ ...x, rancho_nombre: x.ranchos?.nombre ?? '—' }))),
      leerConCache(`m48_lpt:${r.id}`, userId, orgId, async () =>
        (await lista('m48_lotes_producto', '*, m48_lotes_recepcion(codigo), m48_lotes_compuestos(codigo)', r.id))
          .map((x: any) => ({ ...x, lr_codigo: x.m48_lotes_recepcion?.codigo ?? null, lc_codigo: x.m48_lotes_compuestos?.codigo ?? null }))),
      leerConCache(`m48_lc:${r.id}`, userId, orgId, async () =>
        (await lista('m48_lotes_compuestos', '*, m48_lc_lr(lr_id, m48_lotes_recepcion(id, codigo, proveedor_nombre, fecha))', r.id))
          .map((x: any) => ({
            ...x,
            lotes_recepcion: (x.m48_lc_lr ?? []).map((rel: any) => ({
              id: rel.m48_lotes_recepcion?.id ?? rel.lr_id,
              codigo: rel.m48_lotes_recepcion?.codigo ?? '—',
              proveedor_nombre: rel.m48_lotes_recepcion?.proveedor_nombre ?? '—',
              fecha: rel.m48_lotes_recepcion?.fecha ?? '',
            })),
          }))),
      leerConCache(`m48_fe:${r.id}`, userId, orgId, async () =>
        (await lista('m48_folios_embarque', '*, m48_fe_lpt(lpt_id, numero_tarima, cantidad, cliente, m48_lotes_producto(codigo))', r.id))
          .map((x: any) => ({
            ...x,
            lotes_producto: (x.m48_fe_lpt ?? []).map((rel: any) => ({
              lpt_id: rel.lpt_id,
              lpt_codigo: rel.m48_lotes_producto?.codigo ?? '—',
              numero_tarima: rel.numero_tarima ?? null,
              cantidad: rel.cantidad ?? null,
              cliente: rel.cliente ?? null,
            })),
          }))),
    ]))
  }

  async function precargarM21(userId: string, orgId: string) {
    let estaciones: Awaited<ReturnType<typeof fetchEstacionesOrg>>
    try { estaciones = await fetchEstacionesOrg(orgId) } catch { return }
    const porRancho = new Map<string, typeof estaciones>()
    for (const e of estaciones) porRancho.set(e.rancho_id, [...(porRancho.get(e.rancho_id) ?? []), e])
    const ordenar = (l: typeof estaciones) => [...l].sort((a, b) =>
      a.tipo_trampa.localeCompare(b.tipo_trampa) || (a.orden - b.orden) || a.numero.localeCompare(b.numero))
    await Promise.allSettled([
      leerConCache(CLAVE_ESTACIONES_ORG, userId, orgId, async () => estaciones),
      leerConCache(CLAVE_NFC_ACTIVO, userId, orgId, () => fetchNfcActivo(orgId)),
      ...Array.from(porRancho.entries()).map(([ranchoId, lista]) =>
        leerConCache(claveCacheEstaciones(ranchoId), userId, orgId, async () => ordenar(lista))),
      leerConCache('m21_catalogos', userId, orgId, async () => {
        const [e, c, p] = await Promise.all([
          (supabase as any).from('m21_estado_trampa').select('codigo, label').order('codigo'),
          (supabase as any).from('m21_condiciones').select('codigo, label').order('codigo'),
          (supabase as any).from('m21_plagas').select('codigo, label').order('codigo'),
        ])
        if (e.error || c.error || p.error) throw (e.error ?? c.error ?? p.error)
        return { e: e.data ?? [], c: c.data ?? [], p: p.data ?? [] }
      }),
      leerConCache('m21_revisiones', userId, orgId, async () => {
        const { data, error } = await (supabase as any)
          .from('m21_revision')
          .select(`id, rancho_id, fecha, inspector_nombre, observaciones, created_at, ranchos ( nombre, codigo ),
            m21_resultado ( id, estacion_id, tipo_consumo, estado_trampa, condiciones, senalizacion, estado_equipo, estado_lampara, plaga_detectada, incidencia_id, m21_estaciones ( numero, tipo_trampa ) )`)
          .eq('org_id', orgId)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false })
        if (error) throw error
        return data ?? []
      }),
    ])
  }

  async function precargarAuditoriasInternas(userId: string, orgId: string) {
    const modulosAud = ['m14', 'm15', 'm16', 'm17', 'm18']
    await precargarCache(userId, orgId, modulosAud.flatMap((m) => [
      {
        clave: `${m}_catalogo`,
        omitirSiMenorA: 12 * 60 * 60 * 1000,
        fetcher: async () => {
          const [s, p] = await Promise.all([
            (supabase as any).from(`${m}_secciones`).select('*').order('orden'),
            (supabase as any).from(`${m}_preguntas`).select('*').eq('activo', true).order('orden_seccion'),
          ])
          if (s.error || p.error) throw (s.error ?? p.error)
          return { secs: s.data ?? [], pregs: p.data ?? [] }
        },
      },
      {
        clave: `${m}_auditorias`,
        fetcher: async () => {
          const { data, error } = await (supabase as any)
            .from(`${m}_auditorias`)
            .select('*, ranchos(nombre, codigo)')
            .eq('org_id', orgId)
            .order('fecha', { ascending: false })
            .limit(50)
          if (error) throw error
          return data ?? []
        },
      },
    ]))
    // Respuestas de los borradores (para poder continuarlos sin red)
    await Promise.allSettled(modulosAud.map(async (m) => {
      const { data: borradores } = await (supabase as any)
        .from(`${m}_auditorias`).select('id').eq('org_id', orgId).eq('estado', 'borrador').limit(20)
      await Promise.allSettled((borradores ?? []).map((b: any) =>
        leerConCache(`${m}_respuestas:${b.id}`, userId, orgId, async () => {
          const { data, error } = await (supabase as any).from(`${m}_respuestas`).select('*').eq('auditoria_id', b.id)
          if (error) throw error
          return data ?? []
        })))
    }))
  }

  async function precargarM24(userId: string, orgId: string) {
    const [saldosR, quimicosR, movsR] = await Promise.all([
      (supabase as any).from('v_m24_saldo_quimico').select('*').eq('org_id', orgId).order('nombre'),
      (supabase as any).from('m24_quimicos').select('*').eq('org_id', orgId).order('orden').order('nombre'),
      (supabase as any).from('m24_movimientos').select('*').eq('org_id', orgId)
        .order('fecha', { ascending: true }).order('created_at', { ascending: true }),
    ])
    if (saldosR.error || quimicosR.error || movsR.error) return
    const quimicos: any[] = quimicosR.data ?? []
    const movs: any[] = movsR.data ?? []
    const porRancho = new Map<string, any[]>()
    for (const q of quimicos) porRancho.set(q.rancho_id, [...(porRancho.get(q.rancho_id) ?? []), q])
    const porQuimico = new Map<string, any[]>()
    for (const m of movs) porQuimico.set(m.quimico_id, [...(porQuimico.get(m.quimico_id) ?? []), m])
    await Promise.allSettled([
      leerConCache('m24_saldos', userId, orgId, async () => saldosR.data ?? []),
      ...Array.from(porRancho.entries()).map(([ranchoId, lista]) =>
        leerConCache(`m24_quimicos:${ranchoId}`, userId, orgId, async () => lista)),
      ...quimicos.map((q) =>
        leerConCache(`m24_movs:${q.id}`, userId, orgId, async () => porQuimico.get(q.id) ?? [])),
    ])
  }

  async function precargarItemsPorRancho(userId: string, orgId: string) {
    const { data: ranchos } = await supabase
      .from('ranchos')
      .select('id')
      .eq('org_id', orgId)
      .eq('activo', true)
    if (!ranchos) return
    await Promise.allSettled(
      ranchos.flatMap((r: any) => [
        leerConCache(
          `m46_items:${r.id}`,
          userId,
          orgId,
          async () => {
            const { data } = await (supabase as any)
              .from('m46_items')
              .select('id, area, nombre, activo, orden')
              .eq('org_id', orgId)
              .eq('rancho_id', r.id)
              .order('orden')
            return data ?? []
          },
        ),
        leerConCache(
          `m47_items:${r.id}`,
          userId,
          orgId,
          async () => {
            const { data } = await (supabase as any)
              .from('m47_items')
              .select('id, tipo, nombre, activo, orden')
              .eq('org_id', orgId)
              .eq('rancho_id', r.id)
              .order('tipo')
              .order('orden')
            return data ?? []
          },
        ),
      ]),
    )
  }

  // Precarga al iniciar sesión con red
  useEffect(() => {
    if (!userId || !orgId) return
    ejecutarPrecarga()
  }, [userId, orgId, ejecutarPrecarga])

  // Precarga al volver la red
  useEffect(() => {
    const handleOnline = () => ejecutarPrecarga()
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [ejecutarPrecarga])

  return (
    <ModulosContext.Provider value={{
      modulos,
      loading: authLoading || modulosLoading,
      error,
      refetch,
      terminosSitio: resolverTerminos(termino),
      desdeCache,
      guardadoEn,
    }}>
      {children}
    </ModulosContext.Provider>
  )
}

export function useModulosContext(): ModulosContextValue {
  const ctx = useContext(ModulosContext)
  if (!ctx) throw new Error('useModulosContext debe usarse dentro de ModulosProvider')
  return ctx
}
