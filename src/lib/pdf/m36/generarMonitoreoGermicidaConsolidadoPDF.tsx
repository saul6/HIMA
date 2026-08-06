import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { MonitoreoGermicidaPDF, type MonitoreoRow } from './MonitoreoGermicidaPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'

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

  const blob = await pdf(
    <MonitoreoGermicidaPDF
      rancho={ranchoNombre}
      orgNombre={orgNombre}
      desde={desde}
      hasta={hasta}
      monitoreos={monitoreos}
    />
  ).toBlob()
  descargar(blob, nombrePdf('Monitoreo_Solucion_Germicida_consolidado', `${desde}_${hasta}`, ranchoNombre))
}
