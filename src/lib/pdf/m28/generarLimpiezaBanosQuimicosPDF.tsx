import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  LimpiezaBanosQuimicosPDF,
  type M28ItemPDF,
  type M28DiaDataPDF,
  type ValorM28PDF,
  type LimpiezaBanosQuimicosPaginaProps,
} from './LimpiezaBanosQuimicosPDF'

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

export async function generarLimpiezaBanosQuimicosPDF(
  registro: { id: string; rancho_nombre: string; anio: number; mes: number; observaciones: string | null },
  instalacionCodigo: string,
  items: M28ItemPDF[],
  resultados: Record<number, Record<string, ValorM28PDF>>,
  diasData: Record<number, M28DiaDataPDF>,
): Promise<void> {
  const mesStr = String(registro.mes).padStart(2, '0')
  const filename = `Limpieza_Banos_Quimicos_${registro.anio}-${mesStr}.pdf`

  const props: LimpiezaBanosQuimicosPaginaProps = {
    instalacion: registro.rancho_nombre,
    instalacionCodigo,
    anio: registro.anio,
    mes: registro.mes,
    items,
    resultados,
    diasData,
    observaciones: registro.observaciones,
  }

  const blob = await pdf(<LimpiezaBanosQuimicosPDF {...props} />).toBlob()
  descargar(blob, filename)
}

export async function generarBlobLimpiezaBanosQuimicos(id: string, orgId: string): Promise<Blob> {
  const { data: reg, error: e1 } = await tbl('m28_registro_mensual')
    .select('*, ranchos(nombre, codigo)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (e1) throw e1

  const [{ data: itemsData }, { data: resultadosData }, { data: diasRaw }] = await Promise.all([
    tbl('m28_items').select('id, nombre, frecuencia').eq('org_id', orgId).eq('rancho_id', reg.rancho_id).eq('activo', true).order('orden'),
    tbl('m28_resultados').select('item_id, dia, valor').eq('registro_id', id).eq('org_id', orgId),
    tbl('m28_dias').select('*').eq('registro_id', id),
  ])

  const items: M28ItemPDF[] = (itemsData ?? []) as M28ItemPDF[]

  const resultados: Record<number, Record<string, ValorM28PDF>> = {}
  for (const r of (resultadosData ?? []) as any[]) {
    if (!resultados[r.dia]) resultados[r.dia] = {}
    resultados[r.dia][r.item_id] = r.valor as ValorM28PDF
  }

  const diasData: Record<number, M28DiaDataPDF> = {}
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

  const props: LimpiezaBanosQuimicosPaginaProps = {
    instalacion: (reg.ranchos as any)?.nombre ?? '—',
    instalacionCodigo: (reg.ranchos as any)?.codigo ?? '—',
    anio: reg.anio,
    mes: reg.mes,
    items,
    resultados,
    diasData,
    observaciones: reg.observaciones ?? null,
  }

  return pdf(<LimpiezaBanosQuimicosPDF {...props} />).toBlob()
}
