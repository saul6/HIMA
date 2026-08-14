import { pdf } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
import { supabase } from '@/lib/supabase'
import {
  RondinesVigilanciaPDF,
  type M46ItemPDF,
  type M46RondaPDF,
  type M46ResultadoPDF,
} from './RondinesVigilanciaPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'

const tbl = (name: string) => (supabase as any).from(name)

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

async function cargarDatos(id: string, orgId: string) {
  const [rondinRes, rondasRes, resultadosRes] = await Promise.all([
    tbl('m46_rondines')
      .select('*, ranchos(nombre)')
      .eq('id', id)
      .eq('org_id', orgId)
      .single(),
    tbl('m46_rondas')
      .select('numero, hora')
      .eq('rondin_id', id)
      .eq('org_id', orgId)
      .order('numero'),
    tbl('m46_resultados')
      .select('item_id, ronda, valor')
      .eq('rondin_id', id)
      .eq('org_id', orgId),
  ])
  if (rondinRes.error) throw rondinRes.error

  const rondin = rondinRes.data as any
  const ranchoId = rondin.rancho_id as string

  const itemsRes = await tbl('m46_items')
    .select('id, area, nombre, orden')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .eq('activo', true)
    .order('orden')
  if (itemsRes.error) throw itemsRes.error

  return {
    rondin,
    rondas: (rondasRes.data ?? []) as any[],
    resultados: (resultadosRes.data ?? []) as any[],
    items: (itemsRes.data ?? []) as any[],
  }
}

function buildProps(rondin: any, rondas: any[], resultados: any[], items: any[], codigoClave: string) {
  const pdfItems: M46ItemPDF[] = items.map((i) => ({
    id: i.id as string,
    area: i.area as string,
    nombre: i.nombre as string,
  }))
  const pdfRondas: M46RondaPDF[] = rondas.map((r) => ({
    numero: r.numero as number,
    hora: r.hora ?? null,
  }))
  const pdfResultados: M46ResultadoPDF[] = resultados.map((r) => ({
    item_id: r.item_id as string,
    ronda: r.ronda as number,
    valor: r.valor as 'sin_novedad' | 'con_novedad',
  }))
  return { pdfItems, pdfRondas, pdfResultados, codigoClave, rondin }
}

export async function generarBlobRondinesVigilancia(id: string, orgId: string, codigoClave: string): Promise<Blob> {
  const { rondin, rondas, resultados, items } = await cargarDatos(id, orgId)
  const { pdfItems, pdfRondas, pdfResultados } = buildProps(rondin, rondas, resultados, items, codigoClave)
  return pdf(
    <RondinesVigilanciaPDF
      rancho={rondin.ranchos?.nombre ?? '—'}
      fecha={rondin.fecha}
      turno={rondin.turno ?? null}
      vigilante={rondin.vigilante ?? '—'}
      jefe_seguridad={rondin.jefe_seguridad ?? null}
      observaciones={rondin.observaciones ?? null}
      items={pdfItems}
      rondas={pdfRondas}
      resultados={pdfResultados}
      codigoClave={codigoClave}
    />
  ).toBlob()
}

export async function generarRondinesVigilanciaPDF(id: string, orgId: string, codigoClave: string): Promise<void> {
  const { rondin, rondas, resultados, items } = await cargarDatos(id, orgId)
  const { pdfItems, pdfRondas, pdfResultados } = buildProps(rondin, rondas, resultados, items, codigoClave)
  const blob = await pdf(
    <RondinesVigilanciaPDF
      rancho={rondin.ranchos?.nombre ?? '—'}
      fecha={rondin.fecha}
      turno={rondin.turno ?? null}
      vigilante={rondin.vigilante ?? '—'}
      jefe_seguridad={rondin.jefe_seguridad ?? null}
      observaciones={rondin.observaciones ?? null}
      items={pdfItems}
      rondas={pdfRondas}
      resultados={pdfResultados}
      codigoClave={codigoClave}
    />
  ).toBlob()
  descargar(blob, nombrePdf('Rondines_Vigilancia', rondin.fecha))
}

export async function generarRondinesVigilanciaConsolidadoPDF(
  ranchoId: string,
  orgId: string,
  desde: string,
  hasta: string,
  codigoClave: string,
): Promise<void> {
  const { data, error } = await tbl('m46_rondines')
    .select('id')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  if (!data?.length) throw new Error('Sin registros en el rango de fechas')

  const blobs = await Promise.all(
    (data as any[]).map((r) => generarBlobRondinesVigilancia(r.id as string, orgId, codigoClave))
  )

  const merged = await PDFDocument.create()
  for (const blob of blobs) {
    const bytes = await blob.arrayBuffer()
    const doc = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach((p) => merged.addPage(p))
  }
  const bytes = await merged.save()
  const mergedBlob = new Blob([bytes], { type: 'application/pdf' })
  descargar(mergedBlob, `Rondines_Vigilancia_${desde}_${hasta}.pdf`)
}
