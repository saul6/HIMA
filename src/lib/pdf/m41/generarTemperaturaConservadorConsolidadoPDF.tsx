import { pdf } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
import { supabase } from '@/lib/supabase'
import { TemperaturaConservadorPDF, type M41RegistroDataPDF, type M41LecturaPDF } from './TemperaturaConservadorPDF'

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

export async function generarTemperaturaConservadorConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  instalacionNombre: string,
  orgNombre: string,
): Promise<void> {
  let query = (supabase as any)
    .from('m41_registros')
    .select('*, ranchos(nombre)')
    .eq('org_id', orgId)
    .gte('fecha', desde).lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })
  if (ranchoId) query = query.eq('rancho_id', ranchoId)

  const { data: registros, error } = await query
  if (error) throw error
  if (!registros?.length) throw new Error('Sin registros en el rango seleccionado')

  const ids = (registros as any[]).map((r: any) => r.id)
  const { data: todasLecturas, error: eL } = await (supabase as any)
    .from('m41_lecturas')
    .select('registro_id, hora, temperatura')
    .in('registro_id', ids)
    .order('registro_id').order('hora')
  if (eL) throw eL

  const lecturasPorRegistro: Record<string, M41LecturaPDF[]> = {}
  for (const l of (todasLecturas ?? []) as any[]) {
    if (!lecturasPorRegistro[l.registro_id]) lecturasPorRegistro[l.registro_id] = []
    lecturasPorRegistro[l.registro_id].push({ hora: l.hora, temperatura: l.temperatura ?? null })
  }

  const merged = await PDFDocument.create()
  for (const r of registros as any[]) {
    const d: M41RegistroDataPDF = {
      orgNombre,
      instalacion: r.ranchos?.nombre ?? instalacionNombre,
      fecha: r.fecha,
      temp_min: r.temp_min ?? null,
      temp_max: r.temp_max ?? null,
      observaciones: r.observaciones ?? null,
      lecturas: lecturasPorRegistro[r.id] ?? [],
    }
    const blob = await pdf(<TemperaturaConservadorPDF d={d} />).toBlob()
    const bytes = await blob.arrayBuffer()
    const doc = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach(p => merged.addPage(p))
  }

  const bytes = await merged.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  descargar(blob, `Temperaturas_Conservador-consolidado-${desde}-${hasta}.pdf`)
}
