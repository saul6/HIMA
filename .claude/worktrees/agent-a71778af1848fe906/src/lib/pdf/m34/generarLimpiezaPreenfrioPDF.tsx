import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  LimpiezaPreenfrioPDF,
  type M34ItemPDF,
  type M34DiaDataPDF,
  type ValorM34PDF,
  type LimpiezaPreenfrioPaginaProps,
} from './LimpiezaPreenfrioPDF'

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

export async function generarLimpiezaPreenfrioPDF(
  registro: { id: string; rancho_nombre: string; anio: number; mes: number; observaciones: string | null },
  instalacionCodigo: string,
  items: M34ItemPDF[],
  resultados: Record<number, Record<string, ValorM34PDF>>,
  diasData: Record<number, M34DiaDataPDF>,
  codigoClave: string,
): Promise<void> {
  const mesStr = String(registro.mes).padStart(2, '0')
  const filename = `Limpieza_Preenfrio_Conservador_${registro.anio}-${mesStr}.pdf`

  const props: LimpiezaPreenfrioPaginaProps = {
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

  const blob = await pdf(<LimpiezaPreenfrioPDF {...props} />).toBlob()
  descargar(blob, filename)
}

export async function generarBlobLimpiezaPreenfrio(id: string, orgId: string, codigoClave: string): Promise<Blob> {
  const { data: reg, error: e1 } = await tbl('m34_registro_mensual')
    .select('*, ranchos(nombre, codigo)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (e1) throw e1

  const [{ data: itemsData }, { data: resultadosData }, { data: diasRaw }] = await Promise.all([
    tbl('m34_items').select('id, nombre, frecuencia, es_inspeccion_plaga').eq('org_id', orgId).eq('rancho_id', reg.rancho_id).eq('activo', true).order('orden'),
    tbl('m34_resultados').select('item_id, dia, valor').eq('registro_id', id).eq('org_id', orgId),
    tbl('m34_dias').select('*').eq('registro_id', id),
  ])

  const items: M34ItemPDF[] = (itemsData ?? []) as M34ItemPDF[]

  const resultados: Record<number, Record<string, ValorM34PDF>> = {}
  for (const r of (resultadosData ?? []) as any[]) {
    if (!resultados[r.dia]) resultados[r.dia] = {}
    resultados[r.dia][r.item_id] = r.valor as ValorM34PDF
  }

  const diasData: Record<number, M34DiaDataPDF> = {}
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

  const props: LimpiezaPreenfrioPaginaProps = {
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

  return pdf(<LimpiezaPreenfrioPDF {...props} />).toBlob()
}
