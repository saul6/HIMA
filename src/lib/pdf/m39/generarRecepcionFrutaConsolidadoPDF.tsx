import { pdf } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
import { supabase } from '@/lib/supabase'
import { RecepcionFrutaPDF, type M39RecepcionDataPDF, type M39LineaPDF } from './RecepcionFrutaPDF'

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

  const ids = (recepciones as any[]).map((r: any) => r.id)
  const { data: todasLineas, error: eLineas } = await (supabase as any)
    .from('m39_lineas')
    .select('*')
    .in('recepcion_id', ids)
    .order('recepcion_id')
    .order('orden')
  if (eLineas) throw eLineas

  const lineasPorRecepcion: Record<string, M39LineaPDF[]> = {}
  for (const l of (todasLineas ?? []) as any[]) {
    if (!lineasPorRecepcion[l.recepcion_id]) lineasPorRecepcion[l.recepcion_id] = []
    lineasPorRecepcion[l.recepcion_id].push({
      orden: l.orden,
      hora: l.hora ?? null,
      codigo_productor: l.codigo_productor ?? null,
      tipo: l.tipo ?? 'convencional',
      pase_anden: l.pase_anden ?? false,
      producto: l.producto ?? null,
      cant_6oz: l.cant_6oz ?? null,
      cant_12oz: l.cant_12oz ?? null,
      cant_18oz: l.cant_18oz ?? null,
    })
  }

  const merged = await PDFDocument.create()
  for (const r of recepciones as any[]) {
    const d: M39RecepcionDataPDF = {
      orgNombre,
      instalacion: r.ranchos?.nombre ?? instalacionNombre,
      fecha: r.fecha,
      empresa: r.empresa ?? null,
      observaciones: r.observaciones ?? null,
      lineas: lineasPorRecepcion[r.id] ?? [],
    }
    const blob = await pdf(<RecepcionFrutaPDF d={d} codigoClave={codigoClave} />).toBlob()
    const bytes = await blob.arrayBuffer()
    const doc = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach(p => merged.addPage(p))
  }

  const bytes = await merged.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const slug = instalacionNombre.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
  const filename = `Recepcion_Fruta_consolidado_${desde}_${hasta}${slug ? '_' + slug : ''}.pdf`
  descargar(blob, filename)
}
