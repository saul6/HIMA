// Generador consolidado M21 — Revisión de Estaciones de Monitoreo de Plagas.
// Agrupa múltiples revisiones en un solo PDF por rango de fechas.

import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { MonitoreoEstacionesConsolidadoPDF } from './MonitoreoEstacionesPDF'
import { construirDatosM21 } from './generarMonitoreoEstacionesPDF'
import { obtenerFirmasParaPdf, firmaDetalleAParaPdf } from '@/hooks/useFirmasRegistro'

export async function generarMonitoreoEstacionesConsolidadoPDF(
  ranchoId: string,
  instalacionNombre: string,
  orgId: string,
  desde: string,   // YYYY-MM-DD
  hasta: string,   // YYYY-MM-DD
  codigoClave: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('m21_revision')
    .select('id')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
  if (error) throw error
  if (!data?.length) throw new Error('Sin revisiones M21 en el rango seleccionado')

  const rowIds = (data as any[]).map((row: any) => row.id as string)
  const revisionesBase = await Promise.all(
    rowIds.map((id) => construirDatosM21(id, orgId))
  )

  const firmasMapa = rowIds.length > 0
    ? await obtenerFirmasParaPdf('M21', rowIds)
    : {}

  const revisiones = revisionesBase.map((rev, i) => {
    const firmas = firmasMapa[rowIds[i]]
    return {
      ...rev,
      firmaRealizo: firmas?.realizo ? firmaDetalleAParaPdf(firmas.realizo) : null,
      firmaVerifico: firmas?.verifico ? firmaDetalleAParaPdf(firmas.verifico) : null,
    }
  })

  const blob = await pdf(
    <MonitoreoEstacionesConsolidadoPDF
      revisiones={revisiones}
      instalacionNombre={instalacionNombre}
      desde={desde}
      hasta={hasta}
      codigoClave={codigoClave}
    />
  ).toBlob()

  const filename = `revisiones-plagas-${desde}-${hasta}.pdf`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
