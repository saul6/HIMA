// Genera y descarga el PDF individual de un registro M9 (un mes).

import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { PerimetralPDF, type ItemPDFRow, type PerimetralPaginaProps } from './PerimetralPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'

function formatMesLabel(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T12:00:00')
    const label = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  } catch { return isoDate }
}

export async function construirDatosPagina(
  registroId: string,
  orgId: string,
): Promise<PerimetralPaginaProps> {
  const [registroRes, itemsRes] = await Promise.all([
    supabase
      .from('m9_registro_mensual')
      .select('*, ranchos(nombre, codigo), profiles!responsable_id(nombre_completo)')
      .eq('id', registroId)
      .single(),
    supabase
      .from('m9_items_catalogo')
      .select('id, seccion_label, item, default_valor, es_almacen')
      .order('orden'),
  ])

  if (registroRes.error) throw registroRes.error
  const reg = registroRes.data as any

  const tieneAlmacen: boolean = reg.tiene_almacen
  const todosItems = (itemsRes.data ?? []) as (ItemPDFRow & { default_valor: boolean; es_almacen: boolean })[]
  const items: ItemPDFRow[] = todosItems
    .filter((i) => tieneAlmacen || !i.es_almacen)
    .map(({ id, seccion_label, item }) => ({ id, seccion_label, item }))

  const itemDefaultMap: Record<string, boolean> = {}
  for (const i of todosItems) itemDefaultMap[i.id] = i.default_valor

  // Cargar días inspeccionados
  const { data: diasData, error: diasErr } = await supabase
    .from('m9_dias_inspeccion')
    .select('id, fecha')
    .eq('registro_id', registroId)
    .eq('org_id', orgId)
    .order('fecha')
  if (diasErr) throw diasErr
  const diasInspeccionados = (diasData ?? []).map((d: any) => d.fecha as string)
  const diaIds = (diasData ?? []).map((d: any) => d.id as string)
  const diaFechaMap: Record<string, string> = {}
  for (const d of diasData ?? []) diaFechaMap[(d as any).id] = (d as any).fecha

  // Cargar resultados (solo días inspeccionados)
  const matriz: Record<string, Record<string, string>> = {}
  if (diaIds.length > 0) {
    const { data: resData, error: resErr } = await supabase
      .from('m9_resultados')
      .select('dia_id, item_id, valor')
      .in('dia_id', diaIds)
      .eq('org_id', orgId)
    if (resErr) throw resErr
    for (const r of resData ?? []) {
      const fecha = diaFechaMap[(r as any).dia_id]
      if (!fecha) continue
      if (!matriz[fecha]) matriz[fecha] = {}
      matriz[fecha][(r as any).item_id] = (r as any).valor ? 'Si' : 'No'
    }
  }

  // Rellenar celdas sin resultado con default_valor (solo para días inspeccionados)
  for (const fecha of diasInspeccionados) {
    for (const item of items) {
      if (!matriz[fecha]) matriz[fecha] = {}
      if (matriz[fecha][item.id] === undefined) {
        matriz[fecha][item.id] = itemDefaultMap[item.id] ? 'Si' : 'No'
      }
    }
  }

  return {
    rancho: reg.ranchos?.nombre ?? '—',
    ranchoCodigo: reg.ranchos?.codigo ?? '—',
    mesLabel: formatMesLabel(reg.mes),
    mesDate: reg.mes as string,
    realizadoPor: (reg.profiles as any)?.nombre_completo ?? null,
    tieneAlmacen,
    items,
    diasInspeccionados,
    matriz,
    observaciones: reg.observaciones ?? null,
    otro: reg.otro ?? null,
  }
}

export async function generarPerimetralPDF(
  registroId: string,
  orgId: string,
): Promise<void> {
  const datos = await construirDatosPagina(registroId, orgId)
  const blob = await pdf(<PerimetralPDF {...datos} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombrePdf('Perimetral', datos.mesDate.slice(0, 7), datos.rancho)
  a.click()
  URL.revokeObjectURL(url)
}
