import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { MonitoreoGermicidaPDF, type MonitoreoRow } from './MonitoreoGermicidaPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { obtenerFirmasParaPdf, firmaDetalleAParaPdf } from '@/hooks/useFirmasRegistro'

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

export async function generarMonitoreoGermicidaConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  ranchoNombre: string,
  orgNombre?: string | null,
  codigoClave?: string,
): Promise<void> {
  let query = (supabase as any)
    .from('m36_monitoreos')
    .select('*, ranchos(nombre)')
    .eq('org_id', orgId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })
  if (ranchoId) query = query.eq('rancho_id', ranchoId)

  const { data, error } = await query
  if (error) throw error
  if (!data?.length) throw new Error('Sin registros en el rango seleccionado')

  const monitoreos: MonitoreoRow[] = (data as any[]).map(r => ({
    fecha: r.fecha,
    tipo_germicida: r.tipo_germicida,
    uso: r.uso,
    concentracion: r.concentracion,
    correccion: r.correccion ?? null,
    preparado_por: r.preparado_por,
  }))

  const ids = (data as any[]).map(r => r.id as string)
  const firmasMapa = ids.length > 0
    ? await obtenerFirmasParaPdf('M36', ids)
    : {}

  const primeraFirma = ids.length > 0 ? firmasMapa[ids[0]] : undefined
  const firmaRealizo = primeraFirma?.realizo ? firmaDetalleAParaPdf(primeraFirma.realizo) : null
  const firmaVerifico = primeraFirma?.verifico ? firmaDetalleAParaPdf(primeraFirma.verifico) : null

  const blob = await pdf(
    <MonitoreoGermicidaPDF
      rancho={ranchoNombre}
      orgNombre={orgNombre}
      desde={desde}
      hasta={hasta}
      monitoreos={monitoreos}
      codigoClave={codigoClave ?? 'FRUS'}
      firmaRealizo={firmaRealizo}
      firmaVerifico={firmaVerifico}
    />
  ).toBlob()
  descargar(blob, nombrePdf('Monitoreo_Solucion_Germicida_consolidado', `${desde}_${hasta}`, ranchoNombre))
}
