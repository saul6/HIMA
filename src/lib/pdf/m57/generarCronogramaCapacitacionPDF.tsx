import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { CronogramaCapacitacionPDF, type M57RowPDF } from './CronogramaCapacitacionPDF'

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

export async function generarCronogramaCapacitacionPDF(
  orgId: string,
  orgNombre: string,
): Promise<void> {
  const { data, error } = await (supabase as any)
    .from('m57_cronograma_capacitacion')
    .select('cargo, tematica, periodicidad, mes_programado, observaciones')
    .eq('org_id', orgId)
    .eq('activo', true)
    .order('created_at', { ascending: true })

  if (error) throw error

  const registros: M57RowPDF[] = (data ?? []).map((r: any) => ({
    cargo: r.cargo,
    tematica: r.tematica,
    periodicidad: r.periodicidad,
    mes_programado: r.mes_programado,
    observaciones: r.observaciones ?? null,
  }))

  const blob = await pdf(
    <CronogramaCapacitacionPDF
      orgNombre={orgNombre}
      registros={registros}
    />
  ).toBlob()

  descargar(blob, 'cronograma-capacitacion.pdf')
}
