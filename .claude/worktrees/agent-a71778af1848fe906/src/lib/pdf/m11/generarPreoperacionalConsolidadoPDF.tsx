// Genera y descarga el PDF consolidado de M11 (varios meses de un rancho).

import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { PreoperacionalConsolidadoPDF } from './PreoperacionalPDF'
import { construirDatosPagina } from './generarPreoperacionalPDF'

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export async function generarPreoperacionalConsolidadoPDF(
  ranchoId: string,
  ranchoNombre: string,
  orgId: string,
  desdeYYYYMM: string,   // "2026-04"
  hastaYYYYMM: string,   // "2026-06"
): Promise<void> {
  const desdeDate = desdeYYYYMM + '-01'
  const hastaDate = hastaYYYYMM + '-01'

  const { data, error } = await supabase
    .from('m11_registro_mensual')
    .select('id')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .gte('mes', desdeDate)
    .lte('mes', hastaDate)
    .order('mes')
  if (error) throw error

  const ids = (data ?? []).map((r: any) => r.id as string)
  if (ids.length === 0) throw new Error('No hay registros en ese rango para el rancho seleccionado')

  const paginas = await Promise.all(ids.map((id) => construirDatosPagina(id, orgId)))

  const desdeSlug = slugify(desdeYYYYMM)
  const hastaSlug = slugify(hastaYYYYMM)

  const blob = await pdf(
    <PreoperacionalConsolidadoPDF
      paginas={paginas}
      ranchoNombre={ranchoNombre}
      desde={desdeYYYYMM}
      hasta={hastaYYYYMM}
    />
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `preoperacional-consolidado-${desdeSlug}-${hastaSlug}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
