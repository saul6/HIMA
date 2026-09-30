// Genera y descarga el PDF consolidado de M9 (varios meses de un rancho).

import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { PerimetralConsolidadoPDF } from './PerimetralPDF'
import { construirDatosPagina } from './generarPerimetralPDF'
import { obtenerFirmasParaPdf, firmaDetalleAParaPdf } from '@/hooks/useFirmasRegistro'

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export async function generarPerimetralConsolidadoPDF(
  ranchoId: string,
  ranchoNombre: string,
  orgId: string,
  desdeYYYYMM: string,   // "2026-04"
  hastaYYYYMM: string,   // "2026-06"
): Promise<void> {
  // Convertir a fechas de primer día del mes
  const desdeDate = desdeYYYYMM + '-01'
  const hastaDate = hastaYYYYMM + '-01'

  // Cargar registros del rancho en el rango
  const { data, error } = await supabase
    .from('m9_registro_mensual')
    .select('id')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .gte('mes', desdeDate)
    .lte('mes', hastaDate)
    .order('mes')
  if (error) throw error

  const ids = (data ?? []).map((r: any) => r.id as string)
  if (ids.length === 0) throw new Error('No hay registros en ese rango para el rancho seleccionado')

  // Obtener firmas para todos los registros mensuales (cada uno es representativo de su mes)
  const firmasMapa = ids.length > 0
    ? await obtenerFirmasParaPdf('M9', ids)
    : {}

  const paginasBases = await Promise.all(ids.map((id) => construirDatosPagina(id, orgId)))

  // Mapear firmas a cada página usando el ID del registro mensual
  const paginas = paginasBases.map((pagina, idx) => {
    const registroId = ids[idx]
    const firmasRegistro = registroId ? firmasMapa[registroId] : undefined
    return {
      ...pagina,
      firmaRealizo: firmasRegistro?.realizo ? firmaDetalleAParaPdf(firmasRegistro.realizo) : null,
      firmaVerifico: firmasRegistro?.verifico ? firmaDetalleAParaPdf(firmasRegistro.verifico) : null,
    }
  })

  const desdeSlug = slugify(desdeYYYYMM)
  const hastaSlug = slugify(hastaYYYYMM)

  const blob = await pdf(
    <PerimetralConsolidadoPDF
      paginas={paginas}
      ranchoNombre={ranchoNombre}
      desde={desdeYYYYMM}
      hasta={hastaYYYYMM}
    />
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `perimetral-consolidado-${desdeSlug}-${hastaSlug}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
