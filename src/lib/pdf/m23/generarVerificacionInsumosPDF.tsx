import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  VerificacionInsumosPDF,
  type M23ItemPDFRow,
  type VerificacionInsumosPaginaProps,
} from './VerificacionInsumosPDF'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

function formatMesLabel(isoDate: string): string {
  try {
    const label = new Date(isoDate + 'T12:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
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

export async function construirDatosPaginaM23(
  registroId: string,
  orgId: string,
): Promise<VerificacionInsumosPaginaProps> {
  const { data: reg, error: regErr } = await tbl('m23_registro_mensual')
    .select('*, ranchos(nombre, codigo)')
    .eq('id', registroId)
    .single()
  if (regErr) throw regErr

  const { data: insumosData, error: insErr } = await tbl('m23_insumos')
    .select('id, area, insumo, orden')
    .eq('org_id', orgId)
    .eq('rancho_id', (reg as any).rancho_id)
    .eq('activo', true)
    .order('area')
    .order('orden')
  if (insErr) throw insErr

  const items: M23ItemPDFRow[] = (insumosData ?? []).map((i: any) => ({
    id: i.id,
    area: i.area,
    insumo: i.insumo,
  }))

  const { data: diasData, error: diasErr } = await tbl('m23_dias_inspeccion')
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
    const { data: resData, error: resErr } = await tbl('m23_resultados')
      .select('dia_id, insumo_id, valor, codigo_correctivo')
      .in('dia_id', diaIds)
      .eq('org_id', orgId)
    if (resErr) throw resErr

    for (const r of resData ?? []) {
      const fecha = diaFechaMap[(r as any).dia_id]
      if (!fecha) continue
      if (!matriz[fecha]) matriz[fecha] = {}
      matriz[fecha][(r as any).insumo_id] = valorPDF((r as any).valor)
      if ((r as any).codigo_correctivo && (r as any).valor === 'NO') {
        const itemLabel = items.find((i) => i.id === (r as any).insumo_id)?.insumo ?? '—'
        codigosCorrectivos.push({
          diaNum: String(new Date(fecha + 'T12:00:00').getDate()),
          itemLabel,
          codigo: (r as any).codigo_correctivo,
        })
      }
    }
  }

  for (const fecha of diasInspeccionados) {
    if (!matriz[fecha]) matriz[fecha] = {}
    for (const item of items) {
      if (matriz[fecha][item.id] === undefined) {
        matriz[fecha][item.id] = 'Si'
      }
    }
  }

  return {
    instalacion: (reg as any).ranchos?.nombre ?? '—',
    instalacionCodigo: (reg as any).ranchos?.codigo ?? '—',
    mesLabel: formatMesLabel((reg as any).mes),
    mesDate: (reg as any).mes as string,
    verificoNombre: (reg as any).verifico_nombre ?? null,
    autorizoNombre: (reg as any).autorizo_nombre ?? null,
    items,
    diasInspeccionados,
    matriz,
    codigosCorrectivos,
    observaciones: (reg as any).observaciones ?? null,
  }
}

export async function generarVerificacionInsumosPDF(registroId: string, orgId: string): Promise<void> {
  const datos = await construirDatosPaginaM23(registroId, orgId)
  const mesSlug = slugify(datos.mesLabel)
  const blob = await pdf(<VerificacionInsumosPDF {...datos} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `verificacion-insumos-${mesSlug}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export async function generarBlobVerificacionInsumos(registroId: string, orgId: string): Promise<Blob> {
  const datos = await construirDatosPaginaM23(registroId, orgId)
  return pdf(<VerificacionInsumosPDF {...datos} />).toBlob()
}
