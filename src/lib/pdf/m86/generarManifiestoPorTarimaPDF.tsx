import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { ManifiestoPorTarimaPDF } from './ManifiestoPorTarimaPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { mergePDFBlobs } from '@/lib/pdf/unirPdf'
import { cargarDetalleM86 } from '@/hooks/useM86Manifiesto'

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

export async function blobManifiestoPorTarima(id: string, orgId: string, codigoClave: string): Promise<{ blob: Blob; fecha: string }> {
  const [d, o] = await Promise.all([
    cargarDetalleM86(id),
    (supabase as any).from('organizaciones').select('nombre').eq('id', orgId).single(),
  ])
  const blob = await pdf(<ManifiestoPorTarimaPDF d={d} orgNombre={o.data?.nombre ?? ''} codigoClave={codigoClave} />).toBlob()
  return { blob, fecha: d.m.fecha }
}

export async function generarManifiestoPorTarimaPDF(id: string, orgId: string, codigoClave: string): Promise<void> {
  const { blob, fecha } = await blobManifiestoPorTarima(id, orgId, codigoClave)
  descargar(blob, nombrePdf('Manifiesto_Embarque', fecha))
}

/** Consolidado por rango: todos los manifiestos del periodo en un solo PDF. Devuelve cuántos. */
export async function generarManifiestoPorTarimaConsolidadoPDF(orgId: string, desde: string, hasta: string, codigoClave: string): Promise<number> {
  const { data, error } = await (supabase as any).from('m86_manifiestos').select('id').eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
    .order('fecha').order('created_at')
  if (error) throw error
  const ids = ((data ?? []) as { id: string }[]).map((x) => x.id)
  if (ids.length === 0) return 0
  const blobs: Blob[] = []
  for (const id of ids) blobs.push((await blobManifiestoPorTarima(id, orgId, codigoClave)).blob)
  descargar(await mergePDFBlobs(blobs), `Manifiesto_Embarque-consolidado-${desde}-${hasta}.pdf`)
  return ids.length
}
