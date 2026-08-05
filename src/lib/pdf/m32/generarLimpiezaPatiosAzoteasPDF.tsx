import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  LimpiezaPatiosAzoteasPDF,
  type M32ItemPDF,
  type M32DiaDataPDF,
  type ValorM32PDF,
  type LimpiezaPatiosAzoteasPaginaProps,
} from './LimpiezaPatiosAzoteasPDF'

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

export async function generarLimpiezaPatiosAzoteasPDF(
  registro: { id: string; rancho_nombre: string; anio: number; mes: number; observaciones: string | null },
  instalacionCodigo: string,
  items: M32ItemPDF[],
  resultados: Record<number, Record<string, ValorM32PDF>>,
  diasData: Record<number, M32DiaDataPDF>,
): Promise<void> {
  const mesStr = String(registro.mes).padStart(2, '0')
  const filename = `Limpieza_Patios_Azoteas_${registro.anio}-${mesStr}.pdf`

  const props: LimpiezaPatiosAzoteasPaginaProps = {
    instalacion: registro.rancho_nombre,
    instalacionCodigo,
    anio: registro.anio,
    mes: registro.mes,
    items,
    resultados,
    diasData,
    observaciones: registro.observaciones,
  }

  const blob = await pdf(<LimpiezaPatiosAzoteasPDF {...props} />).toBlob()
  descargar(blob, filename)
}

export async function generarBlobLimpiezaPatiosAzoteas(id: string, orgId: string): Promise<Blob> {
  const { data: reg, error: e1 } = await tbl('m32_registro_mensual')
    .select('*, ranchos(nombre, codigo)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (e1) throw e1

  const [{ data: itemsData }, { data: resultadosData }, { data: diasRaw }] = await Promise.all([
    tbl('m32_items').select('id, nombre, frecuencia').eq('org_id', orgId).eq('rancho_id', reg.rancho_id).eq('activo', true).order('orden'),
    tbl('m32_resultados').select('item_id, dia, valor').eq('registro_id', id).eq('org_id', orgId),
    tbl('m32_dias').select('*').eq('registro_id', id),
  ])

  const items: M32ItemPDF[] = (itemsData ?? []) as M32ItemPDF[]

  const resultados: Record<number, Record<string, ValorM32PDF>> = {}
  for (const r of (resultadosData ?? []) as any[]) {
    if (!resultados[r.dia]) resultados[r.dia] = {}
    resultados[r.dia][r.item_id] = r.valor as ValorM32PDF
  }

  const diasData: Record<number, M32DiaDataPDF> = {}
  for (const d of (diasRaw ?? []) as any[]) {
    diasData[d.dia] = {
      realizo: d.realizo ?? null,
      aprobo: d.aprobo ?? null,
    }
  }

  const props: LimpiezaPatiosAzoteasPaginaProps = {
    instalacion: (reg.ranchos as any)?.nombre ?? '—',
    instalacionCodigo: (reg.ranchos as any)?.codigo ?? '—',
    anio: reg.anio,
    mes: reg.mes,
    items,
    resultados,
    diasData,
    observaciones: reg.observaciones ?? null,
  }

  return pdf(<LimpiezaPatiosAzoteasPDF {...props} />).toBlob()
}
