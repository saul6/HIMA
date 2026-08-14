import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { VerificacionInsumosConsolidadoPDF } from './VerificacionInsumosPDF'
import { construirDatosPaginaM23 } from './generarVerificacionInsumosPDF'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export async function generarVerificacionInsumosConsolidadoPDF(
  ranchoId: string,
  instalacionNombre: string,
  orgId: string,
  desdeYYYYMM: string,
  hastaYYYYMM: string,
  codigoClave: string,
): Promise<void> {
  const desdeDate = desdeYYYYMM + '-01'
  const hastaDate = hastaYYYYMM + '-01'

  const { data, error } = await tbl('m23_registro_mensual')
    .select('id')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .gte('mes', desdeDate)
    .lte('mes', hastaDate)
    .order('mes')
  if (error) throw error

  const ids = (data ?? []).map((r: any) => r.id as string)
  if (ids.length === 0) throw new Error('No hay registros en ese rango para la instalacion seleccionada')

  const paginas = await Promise.all(ids.map((id) => construirDatosPaginaM23(id, orgId)))

  const desdeSlug = slugify(desdeYYYYMM)
  const hastaSlug = slugify(hastaYYYYMM)

  const blob = await pdf(
    <VerificacionInsumosConsolidadoPDF
      paginas={paginas}
      instalacionNombre={instalacionNombre}
      desde={desdeYYYYMM}
      hasta={hastaYYYYMM}
      codigoClave={codigoClave}
    />
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `verificacion-insumos-consolidado-${desdeSlug}-${hastaSlug}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
