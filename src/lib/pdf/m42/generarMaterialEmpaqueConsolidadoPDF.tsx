import { pdf } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
import { supabase } from '@/lib/supabase'
import { MaterialEmpaquePDF, type M42MovimientoPDF } from './MaterialEmpaquePDF'

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

export async function generarMaterialEmpaqueConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  orgNombre: string,
): Promise<void> {
  let query = (supabase as any)
    .from('m42_movimientos')
    .select('*, ranchos(nombre)')
    .eq('org_id', orgId)
    .gte('fecha', desde).lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })
  if (ranchoId) query = query.eq('rancho_id', ranchoId)

  const { data: movimientos, error } = await query
  if (error) throw error
  if (!movimientos?.length) throw new Error('Sin registros en el rango seleccionado')

  const merged = await PDFDocument.create()
  for (const r of movimientos as any[]) {
    const d: M42MovimientoPDF = {
      orgNombre,
      instalacion: r.ranchos?.nombre ?? '—',
      empresa: r.empresa ?? null,
      fecha: r.fecha,
      descripcion_material: r.descripcion_material ?? null,
      entrada: r.entrada ?? null,
      salida: r.salida ?? null,
      total: r.total ?? null,
      entrega: r.entrega ?? null,
      recibe: r.recibe ?? null,
      mat_integro: r.mat_integro ?? true,
      mat_buen_estado: r.mat_buen_estado ?? true,
      mat_limpio: r.mat_limpio ?? true,
      mat_libre_olores: r.mat_libre_olores ?? true,
      mat_libre_plagas: r.mat_libre_plagas ?? true,
      mat_otros: r.mat_otros ?? null,
      tr_integro: r.tr_integro ?? true,
      tr_buen_estado: r.tr_buen_estado ?? true,
      tr_limpio: r.tr_limpio ?? true,
      tr_libre_olores: r.tr_libre_olores ?? true,
      tr_libre_plagas: r.tr_libre_plagas ?? true,
      tr_otros: r.tr_otros ?? null,
      observaciones: r.observaciones ?? null,
    }
    const blob = await pdf(<MaterialEmpaquePDF d={d} />).toBlob()
    const bytes = await blob.arrayBuffer()
    const doc = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach(p => merged.addPage(p))
  }

  const bytes = await merged.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  descargar(blob, `Material_Empaque-consolidado-${desde}-${hasta}.pdf`)
}
