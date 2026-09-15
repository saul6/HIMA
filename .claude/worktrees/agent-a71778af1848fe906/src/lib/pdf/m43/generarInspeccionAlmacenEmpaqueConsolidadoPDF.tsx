import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { InspeccionAlmacenEmpaqueConsolidadoPDF } from './InspeccionAlmacenEmpaquePDF'
import { construirDatosPaginaM43 } from './generarInspeccionAlmacenEmpaquePDF'

export async function generarInspeccionAlmacenEmpaqueConsolidadoPDF(
  ranchoId: string,
  instalacionNombre: string,
  orgId: string,
  desde: string,
  hasta: string,
  codigoClave: string,
): Promise<void> {
  const tbl = supabase as any
  const { data, error } = await tbl
    .from('m43_registro_mensual')
    .select('id, mes')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .gte('mes', desde + '-01')
    .lte('mes', hasta + '-01')
    .order('mes', { ascending: true })
  if (error) throw error
  if (!data?.length) throw new Error('Sin registros en el rango seleccionado')

  const paginas = await Promise.all(
    (data as any[]).map((r: any) => construirDatosPaginaM43(r.id, orgId, codigoClave))
  )

  const blob = await pdf(
    <InspeccionAlmacenEmpaqueConsolidadoPDF
      paginas={paginas}
      instalacionNombre={instalacionNombre}
      desde={desde}
      hasta={hasta}
    />
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href    = url
  a.download = `Inspeccion_Almacen_Empaque-consolidado-${desde}-${hasta}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
