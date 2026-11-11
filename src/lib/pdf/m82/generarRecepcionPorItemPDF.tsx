import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { RecepcionDiaPDF, type M82DatosPDF } from './RecepcionPorItemPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { mergePDFBlobs } from '@/lib/pdf/unirPdf'
import { cargarEntregasM82, cargarHojasM82, type M82Bloque, type M82Item, type M82FirmaHoja } from '@/hooks/useM82Recepcion'
import { formatFirmaFecha, type FirmaParaPdf } from '@/hooks/useFirmasRegistro'

const aPdf = (f: M82FirmaHoja | undefined): FirmaParaPdf | null => f ? ({
  png: f.firma_png, firmante: f.nombre, fecha: formatFirmaFecha(f.firmado_en), sello: f.sello, estado: f.al_dia ? 'vigente' : 'desactualizada',
} as FirmaParaPdf) : null

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

/** PDF del día como Blob (null si no hay entregas aceptadas): un juego de hojas por empresa, cada una con sus tres firmas. */
export async function blobRecepcionPorItem(orgId: string, fecha: string, codigoClave: string): Promise<Blob | null> {
  const [entregas, b, i, o] = await Promise.all([
    cargarEntregasM82(orgId, fecha),
    tbl('m82_bloques').select('*').eq('org_id', orgId).order('orden'),
    tbl('m82_items_catalogo').select('id, bloque_id, codigo, presentacion, clasificacion, orden').eq('org_id', orgId),
    tbl('organizaciones').select('nombre').eq('id', orgId).single(),
  ])
  const aceptadas = entregas.filter((e) => e.estado === 'ACEPTADA')
  if (aceptadas.length === 0) return null
  const ids = Array.from(new Set(aceptadas.map((e) => e.creado_por).filter(Boolean))) as string[]
  const nombres: Record<string, string> = {}
  if (ids.length) {
    const { data } = await tbl('profiles').select('id, nombre_completo').in('id', ids)
    for (const p of data ?? []) nombres[p.id] = p.nombre_completo ?? ''
  }
  const empresas = Array.from(new Set(aceptadas.map((e) => e.empresa))).sort()
  const hojasFirma = await cargarHojasM82(Array.from(new Set(aceptadas.map((e) => e.rancho_id))), fecha)
  const hojas: M82DatosPDF[] = empresas.map((empresa) => {
    const fs = hojasFirma.filter((h) => h.empresa === empresa).flatMap((h) => h.firmas)
    return {
      orgNombre: o.data?.nombre ?? '',
      fecha,
      empresa,
      bloques: (b.data ?? []) as M82Bloque[],
      items: (i.data ?? []) as M82Item[],
      entregas: aceptadas.filter((e) => e.empresa === empresa),
      nombres,
      firmas: { realiza: aPdf(fs.find((f) => f.rol === 'REALIZA')), revisa: aPdf(fs.find((f) => f.rol === 'REVISA')), verifica: aPdf(fs.find((f) => f.rol === 'VERIFICA')) },
    }
  })
  return pdf(<RecepcionDiaPDF hojas={hojas} codigoClave={codigoClave} />).toBlob()
}

/** PDF del día (descarga). Devuelve 0 si no hay entregas aceptadas. */
export async function generarRecepcionPorItemPDF(orgId: string, fecha: string, codigoClave: string): Promise<number> {
  const blob = await blobRecepcionPorItem(orgId, fecha, codigoClave)
  if (!blob) return 0
  descargar(blob, nombrePdf('Recepcion_Por_Item', fecha))
  return 1
}

/** Consolidado por rango: un solo PDF con cada día que tuvo entregas aceptadas. Devuelve los días incluidos. */
export async function generarRecepcionPorItemConsolidadoPDF(orgId: string, desde: string, hasta: string, codigoClave: string): Promise<number> {
  const { data, error } = await tbl('m82_entregas').select('fecha').eq('org_id', orgId).eq('estado', 'ACEPTADA').gte('fecha', desde).lte('fecha', hasta)
  if (error) throw error
  const fechas = Array.from(new Set((data ?? []).map((x: any) => x.fecha as string))).sort()
  const blobs: Blob[] = []
  for (const f of fechas) { const b = await blobRecepcionPorItem(orgId, f, codigoClave); if (b) blobs.push(b) }
  if (blobs.length === 0) return 0
  descargar(await mergePDFBlobs(blobs), `Recepcion_Por_Item-consolidado-${desde}-${hasta}.pdf`)
  return blobs.length
}
