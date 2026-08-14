import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { PreparacionCloroPDF, type PreparacionPDFRow } from './PreparacionCloroPDF'

export async function generarPreparacionCloroConsolidadoPDF(
  ranchoId: string,
  ranchoNombre: string,
  orgNombre: string | undefined,
  orgId: string,
  desde: string,
  hasta: string,
  codigoClave: string,
): Promise<void> {
  const { data, error } = await (supabase as any)
    .from('m27_preparaciones')
    .select('*')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No hay registros en ese rango para el sitio seleccionado')
  }

  const preparaciones: PreparacionPDFRow[] = (data as any[]).map((r) => ({
    fecha: r.fecha,
    area: r.area,
    litros_agua: r.litros_agua,
    ml_cloro: r.ml_cloro,
    responsable: r.responsable ?? null,
    observaciones: r.observaciones ?? null,
  }))

  const desdeSlug = desde.replaceAll('-', '')
  const hastaSlug = hasta.replaceAll('-', '')
  const filename = `Preparacion_de_Cloro-consolidado-${desdeSlug}-${hastaSlug}.pdf`

  const blob = await pdf(
    <PreparacionCloroPDF
      rancho={ranchoNombre}
      orgNombre={orgNombre}
      desde={desde}
      hasta={hasta}
      preparaciones={preparaciones}
      codigoClave={codigoClave}
    />
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
