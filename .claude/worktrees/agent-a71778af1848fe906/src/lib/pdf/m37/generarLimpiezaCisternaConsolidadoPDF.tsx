import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  LimpiezaCisternaConsolidadoPDF,
  type LimpiezaCisternaPaginaProps,
  type M37ItemPDF,
  type M37DiaDataPDF,
  type ValorM37PDF,
} from './LimpiezaCisternaPDF'

const tbl = (name: string) => (supabase as any).from(name)

async function construirPagina(id: string, orgId: string, codigoClave: string): Promise<LimpiezaCisternaPaginaProps> {
  const { data: reg, error: e1 } = await tbl('m37_registro_mensual')
    .select('*, ranchos(nombre, codigo)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (e1) throw e1

  const [{ data: itemsData }, { data: resultadosData }, { data: diasRaw }] = await Promise.all([
    tbl('m37_items').select('id, nombre, frecuencia, es_inspeccion_plaga').eq('org_id', orgId).eq('rancho_id', reg.rancho_id).eq('activo', true).order('orden'),
    tbl('m37_resultados').select('item_id, dia, valor').eq('registro_id', id).eq('org_id', orgId),
    tbl('m37_dias').select('*').eq('registro_id', id),
  ])

  const items: M37ItemPDF[] = (itemsData ?? []) as M37ItemPDF[]

  const resultados: Record<number, Record<string, ValorM37PDF>> = {}
  for (const r of (resultadosData ?? []) as any[]) {
    if (!resultados[r.dia]) resultados[r.dia] = {}
    resultados[r.dia][r.item_id] = r.valor as ValorM37PDF
  }

  const diasData: Record<number, M37DiaDataPDF> = {}
  for (const d of (diasRaw ?? []) as any[]) {
    diasData[d.dia] = {
      cloro_cisterna: d.cloro_cisterna ?? null,
      ajuste_cloro_cisterna: d.ajuste_cloro_cisterna ?? null,
      cloro_desinfeccion: d.cloro_desinfeccion ?? null,
      ajuste_cloro_desinfeccion: d.ajuste_cloro_desinfeccion ?? null,
      realizo: d.realizo ?? null,
      aprobo: d.aprobo ?? null,
    }
  }

  return {
    instalacion: (reg.ranchos as any)?.nombre ?? '—',
    instalacionCodigo: (reg.ranchos as any)?.codigo ?? '—',
    anio: reg.anio,
    mes: reg.mes,
    items,
    resultados,
    diasData,
    observaciones: reg.observaciones ?? null,
    codigoClave,
  }
}

export async function generarLimpiezaCisternaConsolidadoPDF(
  ranchoId: string,
  ranchoNombre: string,
  orgId: string,
  desde: string,
  hasta: string,
  codigoClave: string,
): Promise<void> {
  const anioDesde = parseInt(desde.slice(0, 4))
  const mesDesde  = parseInt(desde.slice(5, 7))
  const anioHasta = parseInt(hasta.slice(0, 4))
  const mesHasta  = parseInt(hasta.slice(5, 7))

  const { data, error } = await tbl('m37_registro_mensual')
    .select('id, anio, mes')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .gte('anio', anioDesde)
    .lte('anio', anioHasta)
    .order('anio')
    .order('mes')
  if (error) throw error

  const ids = ((data ?? []) as any[])
    .filter((r) => {
      if (r.anio === anioDesde && r.anio === anioHasta) return r.mes >= mesDesde && r.mes <= mesHasta
      if (r.anio === anioDesde) return r.mes >= mesDesde
      if (r.anio === anioHasta) return r.mes <= mesHasta
      return true
    })
    .map((r) => r.id as string)

  if (ids.length === 0) throw new Error('No hay registros en ese rango para la instalacion seleccionada')

  const paginas = await Promise.all(ids.map((id) => construirPagina(id, orgId, codigoClave)))

  const blob = await pdf(
    <LimpiezaCisternaConsolidadoPDF
      paginas={paginas}
      instalacionNombre={ranchoNombre}
      desde={desde}
      hasta={hasta}
      codigoClave={codigoClave}
    />
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Limpieza_Cisterna-consolidado-${desde}-${hasta}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
