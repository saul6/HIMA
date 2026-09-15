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

async function cargar(id: string, orgId: string) {
  const { data, error } = await (supabase as any)
    .from('m36_monitoreos')
    .select('*, ranchos(nombre)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (error) throw error
  return data as any
}

export async function generarMonitoreoGermicidaPDF(id: string, orgId: string, codigoClave: string): Promise<void> {
  const r = await cargar(id, orgId)
  const rancho = r.ranchos?.nombre ?? '—'
  const row: MonitoreoRow = {
    fecha: r.fecha,
    tipo_germicida: r.tipo_germicida,
    uso: r.uso,
    concentracion: r.concentracion,
    correccion: r.correccion ?? null,
    preparado_por: r.preparado_por,
  }
  const blob = await pdf(
    <MonitoreoGermicidaPDF rancho={rancho} desde={r.fecha} hasta={r.fecha} monitoreos={[row]} codigoClave={codigoClave} />
  ).toBlob()
  descargar(blob, nombrePdf('Monitoreo_Solucion_Germicida', r.fecha, rancho))
}

export async function generarBlobMonitoreoGermicida(id: string, orgId: string, codigoClave: string): Promise<Blob> {
  const r = await cargar(id, orgId)
  const row: MonitoreoRow = {
    fecha: r.fecha,
    tipo_germicida: r.tipo_germicida,
    uso: r.uso,
    concentracion: r.concentracion,
    correccion: r.correccion ?? null,
    preparado_por: r.preparado_por,
  }
  return pdf(
    <MonitoreoGermicidaPDF rancho={r.ranchos?.nombre ?? '—'} desde={r.fecha} hasta={r.fecha} monitoreos={[row]} codigoClave={codigoClave} />
  ).toBlob()
}
