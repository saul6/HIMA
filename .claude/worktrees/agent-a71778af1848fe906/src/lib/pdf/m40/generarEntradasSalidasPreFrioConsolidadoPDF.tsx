import { pdf } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
import { supabase } from '@/lib/supabase'
import { EntradasSalidasPreFrioPDF, type M40RegistroDataPDF, type M40LineaPDF } from './EntradasSalidasPreFrioPDF'

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

export async function generarEntradasSalidasPreFrioConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  instalacionNombre: string,
  orgNombre: string,
  codigoClave: string,
): Promise<void> {
  let query = (supabase as any)
    .from('m40_registros')
    .select('*, ranchos(nombre)')
    .eq('org_id', orgId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })
  if (ranchoId) query = query.eq('rancho_id', ranchoId)

  const { data: registros, error } = await query
  if (error) throw error
  if (!registros?.length) throw new Error('Sin registros en el rango seleccionado')

  const ids = (registros as any[]).map((r: any) => r.id)
  const { data: todasLineas, error: eLineas } = await (supabase as any)
    .from('m40_lineas')
    .select('*')
    .in('registro_id', ids)
    .order('registro_id')
    .order('orden')
  if (eLineas) throw eLineas

  const lineasPorRegistro: Record<string, M40LineaPDF[]> = {}
  for (const l of (todasLineas ?? []) as any[]) {
    if (!lineasPorRegistro[l.registro_id]) lineasPorRegistro[l.registro_id] = []
    lineasPorRegistro[l.registro_id].push({
      orden: l.orden,
      cuarto_prefrio: l.cuarto_prefrio ?? null,
      fruta: l.fruta ?? null,
      presentacion: l.presentacion ?? null,
      num_tarimas: l.num_tarimas ?? null,
      restos: l.restos ?? null,
      entrada_hora: l.entrada_hora ?? null,
      entrada_temp: l.entrada_temp ?? null,
      salida_hora: l.salida_hora ?? null,
      salida_temp: l.salida_temp ?? null,
      tiempo_total: l.tiempo_total ?? null,
    })
  }

  const merged = await PDFDocument.create()
  for (const r of registros as any[]) {
    const d: M40RegistroDataPDF = {
      orgNombre,
      instalacion: r.ranchos?.nombre ?? instalacionNombre,
      fecha: r.fecha,
      empresa: r.empresa ?? null,
      observaciones: r.observaciones ?? null,
      lineas: lineasPorRegistro[r.id] ?? [],
    }
    const blob = await pdf(<EntradasSalidasPreFrioPDF d={d} codigoClave={codigoClave} />).toBlob()
    const bytes = await blob.arrayBuffer()
    const doc = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach(p => merged.addPage(p))
  }

  const bytes = await merged.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const slug = instalacionNombre.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
  const filename = `Entradas_Salidas_Prefrio_consolidado_${desde}_${hasta}${slug ? '_' + slug : ''}.pdf`
  descargar(blob, filename)
}
