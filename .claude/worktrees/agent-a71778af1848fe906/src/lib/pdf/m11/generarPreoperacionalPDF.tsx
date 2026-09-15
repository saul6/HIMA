// Genera y descarga el PDF individual de un registro mensual M11.

import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { PreoperacionalPDF, type M11ItemPDFRow, type PreoperacionalPaginaProps } from './PreoperacionalPDF'
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
): Promise<PreoperacionalPaginaProps> {
  const [registroRes, itemsRes] = await Promise.all([
    supabase
      .from('m11_registro_mensual')
      .select('*, ranchos(nombre, codigo)')
      .eq('id', registroId)
      .single(),
    supabase
      .from('m11_items_catalogo')
      .select('id, seccion_label, item')
      .order('orden'),
  ])

  if (registroRes.error) throw registroRes.error
  const reg = registroRes.data as any

  const items: M11ItemPDFRow[] = (itemsRes.data ?? []).map((i: any) => ({
    id: i.id,
    seccion_label: i.seccion_label,
    item: i.item,
  }))

  // Cargar días inspeccionados
  const { data: diasData, error: diasErr } = await supabase
    .from('m11_dias_inspeccion')
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
    const { data: resData, error: resErr } = await supabase
      .from('m11_resultados')
      .select('dia_id, item_id, valor, codigo_correctivo')
      .in('dia_id', diaIds)
      .eq('org_id', orgId)
    if (resErr) throw resErr

    for (const r of resData ?? []) {
      const fecha = diaFechaMap[(r as any).dia_id]
      if (!fecha) continue
      if (!matriz[fecha]) matriz[fecha] = {}
      const val = (r as any).valor === 'SI' ? 'Si' : 'No'
      matriz[fecha][(r as any).item_id] = val
      if ((r as any).codigo_correctivo) {
        const itemLabel = items.find((i) => i.id === (r as any).item_id)?.item ?? '—'
        codigosCorrectivos.push({
          diaNum: String(new Date(fecha + 'T12:00:00').getDate()),
          itemLabel,
          codigo: (r as any).codigo_correctivo,
        })
      }
    }
  }

  // Rellenar celdas sin resultado con 'Si' (default) para días inspeccionados
  for (const fecha of diasInspeccionados) {
    if (!matriz[fecha]) matriz[fecha] = {}
    for (const item of items) {
      if (matriz[fecha][item.id] === undefined) {
        matriz[fecha][item.id] = 'Si'
      }
    }
  }

  return {
    rancho: reg.ranchos?.nombre ?? '—',
    ranchoCodigo: reg.ranchos?.codigo ?? '—',
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

export async function generarPreoperacionalPDF(
  registroId: string,
  orgId: string,
): Promise<void> {
  const datos = await construirDatosPagina(registroId, orgId)
  const blob = await pdf(<PreoperacionalPDF {...datos} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombrePdf('Preoperacional_Cosecha', datos.mesDate.slice(0, 7), datos.rancho)
  a.click()
  URL.revokeObjectURL(url)
}
