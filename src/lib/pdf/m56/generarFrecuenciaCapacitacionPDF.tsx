import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { FrecuenciaCapacitacionPDF, type M56RowPDF } from './FrecuenciaCapacitacionPDF'

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

export async function generarFrecuenciaCapacitacionPDF(
  orgId: string,
  orgNombre: string,
  anioFiltro?: number | null,
): Promise<void> {
  let query = (supabase as any)
    .from('m56_frecuencia_capacitacion')
    .select('tema, anio, mes, capacitador, realizado, observaciones')
    .eq('org_id', orgId)
    .eq('activo', true)
    .order('anio', { ascending: false })
    .order('mes', { ascending: true })

  if (anioFiltro) query = query.eq('anio', anioFiltro)

  const { data, error } = await query
  if (error) throw error

  const registros: M56RowPDF[] = (data ?? []).map((r: any) => ({
    tema: r.tema,
    anio: r.anio,
    mes: r.mes,
    capacitador: r.capacitador ?? null,
    realizado: r.realizado ?? false,
    observaciones: r.observaciones ?? null,
  }))

  const blob = await pdf(
    <FrecuenciaCapacitacionPDF
      orgNombre={orgNombre}
      registros={registros}
      anioFiltro={anioFiltro}
    />
  ).toBlob()

  descargar(blob, `frecuencia-capacitacion-${anioFiltro ?? 'todos'}.pdf`)
}
