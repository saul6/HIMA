import { PDFDocument } from 'pdf-lib'
import { supabase } from '@/lib/supabase'
import { generarBlobRecepcionFruta } from './generarRecepcionFrutaPDF'

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

export async function generarRecepcionFrutaConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  instalacionNombre: string,
  orgNombre: string,
  codigoClave: string,
): Promise<void> {
  let query = (supabase as any)
    .from('m39_recepciones')
    .select('*, ranchos(nombre)')
    .eq('org_id', orgId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })
  if (ranchoId) query = query.eq('rancho_id', ranchoId)

  const { data: recepciones, error } = await query
  if (error) throw error
  if (!recepciones?.length) throw new Error('Sin recepciones en el rango seleccionado')

  // Cada recepción se genera con el mismo generador del individual (variante correcta + firmas)
  const merged = await PDFDocument.create()
  for (const r of recepciones as any[]) {
    const blob = await generarBlobRecepcionFruta(r.id, orgId, codigoClave)
    const bytes = await blob.arrayBuffer()
    const doc = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach(p => merged.addPage(p))
  }

  const bytes = await merged.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const filename = `Recepcion_Fruta-consolidado-${desde}-${hasta}.pdf`
  descargar(blob, filename)
}
