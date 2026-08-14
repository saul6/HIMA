import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  LimpiezaOficinasPDF,
  type M31ItemPDF,
  type M31DiaDataPDF,
  type ValorM31PDF,
  type LimpiezaOficinasPaginaProps,
} from './LimpiezaOficinasPDF'

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

export async function generarLimpiezaOficinasPDF(
  registro: { id: string; rancho_nombre: string; anio: number; mes: number; observaciones: string | null },
  instalacionCodigo: string,
  items: M31ItemPDF[],
  resultados: Record<number, Record<string, ValorM31PDF>>,
  diasData: Record<number, M31DiaDataPDF>,
  codigoClave: string,
): Promise<void> {
  const mesStr = String(registro.mes).padStart(2, '0')
  const filename = `Limpieza_Oficinas_${registro.anio}-${mesStr}.pdf`

  const props: LimpiezaOficinasPaginaProps = {
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

  const blob = await pdf(<LimpiezaOficinasPDF {...props} />).toBlob()
  descargar(blob, filename)
}

export async function generarBlobLimpiezaOficinas(id: string, orgId: string, codigoClave: string): Promise<Blob> {
  const { data: reg, error: e1 } = await tbl('m31_registro_mensual')
    .select('*, ranchos(nombre, codigo)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (e1) throw e1

  const [{ data: itemsData }, { data: resultadosData }, { data: diasRaw }] = await Promise.all([
    tbl('m31_items').select('id, nombre, frecuencia').eq('org_id', orgId).eq('rancho_id', reg.rancho_id).eq('activo', true).order('orden'),
    tbl('m31_resultados').select('item_id, dia, valor').eq('registro_id', id).eq('org_id', orgId),
    tbl('m31_dias').select('*').eq('registro_id', id),
  ])

  const items: M31ItemPDF[] = (itemsData ?? []) as M31ItemPDF[]

  const resultados: Record<number, Record<string, ValorM31PDF>> = {}
  for (const r of (resultadosData ?? []) as any[]) {
    if (!resultados[r.dia]) resultados[r.dia] = {}
    resultados[r.dia][r.item_id] = r.valor as ValorM31PDF
  }

  const diasData: Record<number, M31DiaDataPDF> = {}
  for (const d of (diasRaw ?? []) as any[]) {
    diasData[d.dia] = {
      realizo: d.realizo ?? null,
      aprobo: d.aprobo ?? null,
    }
  }

  const props: LimpiezaOficinasPaginaProps = {
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

  return pdf(<LimpiezaOficinasPDF {...props} />).toBlob()
}
