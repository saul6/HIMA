import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  LimpiezaComedorConsolidadoPDF,
  type LimpiezaComedorPaginaProps,
  type M30ItemPDF,
  type M30DiaDataPDF,
  type ValorM30PDF,
} from './LimpiezaComedorPDF'

const tbl = (name: string) => (supabase as any).from(name)

async function construirPagina(id: string, orgId: string): Promise<LimpiezaComedorPaginaProps> {
  const { data: reg, error: e1 } = await tbl('m30_registro_mensual')
    .select('*, ranchos(nombre, codigo)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (e1) throw e1

  const [{ data: itemsData }, { data: resultadosData }, { data: diasRaw }] = await Promise.all([
    tbl('m30_items').select('id, nombre, frecuencia').eq('org_id', orgId).eq('rancho_id', reg.rancho_id).eq('activo', true).order('orden'),
    tbl('m30_resultados').select('item_id, dia, valor').eq('registro_id', id).eq('org_id', orgId),
    tbl('m30_dias').select('*').eq('registro_id', id),
  ])

  const items: M30ItemPDF[] = (itemsData ?? []) as M30ItemPDF[]

  const resultados: Record<number, Record<string, ValorM30PDF>> = {}
  for (const r of (resultadosData ?? []) as any[]) {
    if (!resultados[r.dia]) resultados[r.dia] = {}
    resultados[r.dia][r.item_id] = r.valor as ValorM30PDF
  }

  const diasData: Record<number, M30DiaDataPDF> = {}
  for (const d of (diasRaw ?? []) as any[]) {
    diasData[d.dia] = {
      concentracion_cloro: d.concentracion_cloro ?? null,
      ajuste_cloro: d.ajuste_cloro ?? null,
      concentracion_acido: d.concentracion_acido ?? null,
      ajuste_acido: d.ajuste_acido ?? null,
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
  }
}

export async function generarLimpiezaComedorConsolidadoPDF(
  ranchoId: string,
  ranchoNombre: string,
  orgId: string,
  desde: string,
  hasta: string,
): Promise<void> {
  const anioDesde = parseInt(desde.slice(0, 4))
  const mesDesde  = parseInt(desde.slice(5, 7))
  const anioHasta = parseInt(hasta.slice(0, 4))
  const mesHasta  = parseInt(hasta.slice(5, 7))

  const { data, error } = await tbl('m30_registro_mensual')
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

  const paginas = await Promise.all(ids.map((id) => construirPagina(id, orgId)))

  const blob = await pdf(
    <LimpiezaComedorConsolidadoPDF
      paginas={paginas}
      instalacionNombre={ranchoNombre}
      desde={desde}
      hasta={hasta}
    />
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Limpieza_Comedor-consolidado-${desde}-${hasta}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
