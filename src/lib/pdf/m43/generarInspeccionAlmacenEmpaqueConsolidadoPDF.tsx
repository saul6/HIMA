import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { InspeccionAlmacenEmpaqueConsolidadoPDF } from './InspeccionAlmacenEmpaquePDF'
import { construirDatosPaginaM43 } from './generarInspeccionAlmacenEmpaquePDF'
import { obtenerFirmasParaPdf, firmaDetalleAParaPdf } from '@/hooks/useFirmasRegistro'

export async function generarInspeccionAlmacenEmpaqueConsolidadoPDF(
  ranchoId: string,
  instalacionNombre: string,
  orgId: string,
  desde: string,
  hasta: string,
  codigoClave: string,
): Promise<void> {
  const tbl = supabase as any
  const desdeAnio = parseInt(desde.slice(0, 4))
  const hastaAnio = parseInt(hasta.slice(0, 4))

  const { data, error } = await tbl
    .from('m43_registro_mensual')
    .select('id, anio, mes')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .gte('anio', desdeAnio)
    .lte('anio', hastaAnio)
    .order('anio', { ascending: true })
    .order('mes',  { ascending: true })
  if (error) throw error

  const desdeVal = desdeAnio * 12 + parseInt(desde.slice(5, 7))
  const hastaVal = hastaAnio * 12 + parseInt(hasta.slice(5, 7))
  const filtrados = ((data ?? []) as any[]).filter((r: any) => {
    const v = (r.anio as number) * 12 + (r.mes as number)
    return v >= desdeVal && v <= hastaVal
  })
  if (!filtrados.length) throw new Error('Sin registros en el rango seleccionado')

  const paginasBase = await Promise.all(
    filtrados.map((r: any) => construirDatosPaginaM43(r.id, orgId, codigoClave))
  )

  const idsRepresentativos = filtrados.map((r: any) => r.id as string)
  const firmasMapa = idsRepresentativos.length > 0
    ? await obtenerFirmasParaPdf('M43', idsRepresentativos)
    : {}

  const paginas = paginasBase.map((pagina, idx) => {
    const registroId = filtrados[idx].id as string
    const firmasR = firmasMapa[registroId]
    return {
      ...pagina,
      firmaRealizo: firmasR?.realizo ? firmaDetalleAParaPdf(firmasR.realizo) : null,
      firmaVerifico: firmasR?.verifico ? firmaDetalleAParaPdf(firmasR.verifico) : null,
    }
  })

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
