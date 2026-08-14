import { pdf } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
import { supabase } from '@/lib/supabase'
import { ManifiestoEmbarquePDF, type M38ManifiestoDataPDF, type M38LineaPDF } from './ManifiestoEmbarquePDF'

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

export async function generarManifiestoEmbarqueConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  instalacionNombre: string,
  orgNombre: string,
  codigoClave: string,
): Promise<void> {
  let query = (supabase as any)
    .from('m38_manifiestos')
    .select('*, ranchos(nombre)')
    .eq('org_id', orgId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })
  if (ranchoId) query = query.eq('rancho_id', ranchoId)

  const { data: manifiestos, error } = await query
  if (error) throw error
  if (!manifiestos?.length) throw new Error('Sin manifiestos en el rango seleccionado')

  const ids = (manifiestos as any[]).map((m: any) => m.id)
  const { data: todasLineas, error: eLineas } = await (supabase as any)
    .from('m38_lineas')
    .select('*')
    .in('manifiesto_id', ids)
    .order('manifiesto_id')
    .order('orden')
  if (eLineas) throw eLineas

  const lineasPorManifiesto: Record<string, M38LineaPDF[]> = {}
  for (const l of (todasLineas ?? []) as any[]) {
    if (!lineasPorManifiesto[l.manifiesto_id]) lineasPorManifiesto[l.manifiesto_id] = []
    lineasPorManifiesto[l.manifiesto_id].push({
      orden: l.orden,
      tarima: l.tarima ?? '',
      producto: l.producto ?? '',
      presentacion: l.presentacion ?? '',
      cajas: l.cajas ?? null,
      temp_superior: l.temp_superior ?? null,
      temp_medio: l.temp_medio ?? null,
      temp_inferior: l.temp_inferior ?? null,
    })
  }

  const merged = await PDFDocument.create()
  for (const m of manifiestos as any[]) {
    const d: M38ManifiestoDataPDF = {
      orgNombre,
      instalacion: m.ranchos?.nombre ?? instalacionNombre,
      fecha: m.fecha,
      folio: m.folio ?? null,
      empresa: m.empresa ?? null,
      linea_transportista: m.linea_transportista ?? null,
      nombre_chofer: m.nombre_chofer ?? null,
      placas_tractor: m.placas_tractor ?? null,
      caja_pies: m.caja_pies ?? null,
      econ_tractor: m.econ_tractor ?? null,
      econ_caja: m.econ_caja ?? null,
      num_sello: m.num_sello ?? null,
      num_chismografo: m.num_chismografo ?? null,
      llegada_hora: m.llegada_hora ?? null,
      llegada_temp: m.llegada_temp ?? null,
      carga_hora: m.carga_hora ?? null,
      carga_temp: m.carga_temp ?? null,
      salida_hora: m.salida_hora ?? null,
      salida_temp: m.salida_temp ?? null,
      cond_buen_estado: m.cond_buen_estado ?? true,
      cond_limpio: m.cond_limpio ?? true,
      cond_presencia_plagas: m.cond_presencia_plagas ?? false,
      tar_remontado: m.tar_remontado ?? 'bueno',
      tar_flejado: m.tar_flejado ?? 'bueno',
      tar_limpieza: m.tar_limpieza ?? 'bueno',
      tar_condicion: m.tar_condicion ?? 'bueno',
      tar_distribucion: m.tar_distribucion ?? 'bueno',
      lineas: lineasPorManifiesto[m.id] ?? [],
      observaciones: m.observaciones ?? null,
    }
    const blob = await pdf(<ManifiestoEmbarquePDF d={d} codigoClave={codigoClave} />).toBlob()
    const bytes = await blob.arrayBuffer()
    const doc = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach(p => merged.addPage(p))
  }

  const bytes = await merged.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const slug = instalacionNombre.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
  const filename = `Manifiesto_Embarque_consolidado_${desde}_${hasta}${slug ? '_' + slug : ''}.pdf`
  descargar(blob, filename)
}
