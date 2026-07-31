// Genera y descarga el PDF individual M19 (Inspección Pre-operacional Cuarto Frío).

import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  InspeccionPreoperacionalCoolerPDF,
  type M19ItemPDFRow,
  type InspeccionPreoperacionalCoolerPaginaProps,
} from './InspeccionPreoperacionalCoolerPDF'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

function formatMesLabel(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T12:00:00')
    const label = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  } catch { return isoDate }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function valorPDF(bd: string): string {
  if (bd === 'SI') return 'Si'
  if (bd === 'NO') return 'No'
  return 'N/A'
}

export async function construirDatosPaginaM19(
  registroId: string,
  orgId: string,
): Promise<InspeccionPreoperacionalCoolerPaginaProps> {
  const [registroRes, itemsRes] = await Promise.all([
    tbl('m19_registro_mensual')
      .select('*, ranchos(nombre, codigo)')
      .eq('id', registroId)
      .single(),
    tbl('m19_items_catalogo')
      .select('id, seccion_label, item')
      .order('orden'),
  ])

  if (registroRes.error) throw registroRes.error
  const reg = registroRes.data as any

  const items: M19ItemPDFRow[] = (itemsRes.data ?? []).map((i: any) => ({
    id: i.id,
    seccion_label: i.seccion_label,
    item: i.item,
  }))

  const { data: diasData, error: diasErr } = await tbl('m19_dias_inspeccion')
    .select('id, fecha')
    .eq('registro_id', registroId)
    .eq('org_id', orgId)
    .order('fecha')
  if (diasErr) throw diasErr

  const diasInspeccionados = (diasData ?? []).map((d: any) => d.fecha as string)
  const diaIds = (diasData ?? []).map((d: any) => d.id as string)
  const diaFechaMap: Record<string, string> = {}
  for (const d of diasData ?? []) diaFechaMap[(d as any).id] = (d as any).fecha

  const matriz: Record<string, Record<string, string>> = {}
  const codigosCorrectivos: { diaNum: string; itemLabel: string; codigo: string }[] = []

  if (diaIds.length > 0) {
    const { data: resData, error: resErr } = await tbl('m19_resultados')
      .select('dia_id, item_id, valor, codigo_correctivo')
      .in('dia_id', diaIds)
      .eq('org_id', orgId)
    if (resErr) throw resErr

    for (const r of resData ?? []) {
      const fecha = diaFechaMap[(r as any).dia_id]
      if (!fecha) continue
      if (!matriz[fecha]) matriz[fecha] = {}
      matriz[fecha][(r as any).item_id] = valorPDF((r as any).valor)
      if ((r as any).codigo_correctivo && (r as any).valor === 'NO') {
        const itemLabel = items.find((i) => i.id === (r as any).item_id)?.item ?? '—'
        codigosCorrectivos.push({
          diaNum: String(new Date(fecha + 'T12:00:00').getDate()),
          itemLabel,
          codigo: (r as any).codigo_correctivo,
        })
      }
    }
  }

  // Rellena con 'Si' los ítems sin resultado en días inspeccionados
  for (const fecha of diasInspeccionados) {
    if (!matriz[fecha]) matriz[fecha] = {}
    for (const item of items) {
      if (matriz[fecha][item.id] === undefined) {
        matriz[fecha][item.id] = 'Si'
      }
    }
  }

  return {
    instalacion: reg.ranchos?.nombre ?? '—',
    instalacionCodigo: reg.ranchos?.codigo ?? '—',
    mesLabel: formatMesLabel(reg.mes),
    mesDate: reg.mes as string,
    realizadoPor: reg.realizado_por_nombre ?? null,
    items,
    diasInspeccionados,
    matriz,
    codigosCorrectivos,
    observaciones: reg.observaciones ?? null,
  }
}

export async function generarInspeccionPreoperacionalCoolerPDF(
  registroId: string,
  orgId: string,
): Promise<void> {
  const datos = await construirDatosPaginaM19(registroId, orgId)
  const mesSlug = slugify(datos.mesLabel)
  const instSlug = slugify(datos.instalacion)
  const blob = await pdf(<InspeccionPreoperacionalCoolerPDF {...datos} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inspeccion-preoperacional-${mesSlug}-${instSlug}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
