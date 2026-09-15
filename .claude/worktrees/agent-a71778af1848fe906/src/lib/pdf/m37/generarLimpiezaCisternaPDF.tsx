import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  LimpiezaCisternaPDF,
  type M37ItemPDF,
  type M37DiaDataPDF,
  type ValorM37PDF,
  type LimpiezaCisternaPaginaProps,
} from './LimpiezaCisternaPDF'

const tbl = (name: string) => (supabase as any).from(name)

function descargar(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function generarLimpiezaCisternaPDF(
  registro: { id: string; rancho_nombre: string; anio: number; mes: number; observaciones: string | null },
  instalacionCodigo: string,
  items: M37ItemPDF[],
  resultados: Record<number, Record<string, ValorM37PDF>>,
  diasData: Record<number, M37DiaDataPDF>,
  codigoClave: string,
): Promise<void> {
  const mesStr = String(registro.mes).padStart(2, '0')
  const filename = `Limpieza_Cisterna_${registro.anio}-${mesStr}.pdf`

  const props: LimpiezaCisternaPaginaProps = {
    instalacion: registro.rancho_nombre,
    instalacionCodigo,
    anio: registro.anio,
    mes: registro.mes,
    items,
    resultados,
    diasData,
    observaciones: registro.observaciones,
    codigoClave,
  }

  const blob = await pdf(<LimpiezaCisternaPDF {...props} />).toBlob()
  descargar(blob, filename)
}

export async function generarBlobLimpiezaCisterna(id: string, orgId: string, codigoClave: string): Promise<Blob> {
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

  const props: LimpiezaCisternaPaginaProps = {
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

  return pdf(<LimpiezaCisternaPDF {...props} />).toBlob()
}
