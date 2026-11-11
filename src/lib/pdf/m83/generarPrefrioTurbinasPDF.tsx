import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { PrefrioTurbinasPDF } from './PrefrioTurbinasPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { mergePDFBlobs } from '@/lib/pdf/unirPdf'
import { cargarGruposM83 } from '@/hooks/useM83Prefrio'

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

/** PDF del día (fecha de entrada) como Blob: una hoja por empresa dueña de la fruta; null si no hubo prefrío. */
export async function blobPrefrioTurbinas(orgId: string, fecha: string, codigoClave: string): Promise<Blob | null> {
  const [grupos, o] = await Promise.all([
    cargarGruposM83(orgId, fecha),
    (supabase as any).from('organizaciones').select('nombre').eq('id', orgId).single(),
  ])
  if (grupos.length === 0) return null
  const empresas = Array.from(new Set(grupos.map((g) => g.empresa))).sort()
  const blobs: Blob[] = []
  for (const empresa of empresas) {
    blobs.push(await pdf(
      <PrefrioTurbinasPDF codigoClave={codigoClave}
        d={{ orgNombre: o.data?.nombre ?? '', fecha, empresa, grupos: grupos.filter((g) => g.empresa === empresa) }} />,
    ).toBlob())
  }
  return blobs.length === 1 ? blobs[0] : mergePDFBlobs(blobs)
}

/** PDF del día (descarga, un solo archivo). Devuelve 0 si no hubo prefrío. */
export async function generarPrefrioTurbinasPDF(orgId: string, fecha: string, codigoClave: string): Promise<number> {
  const blob = await blobPrefrioTurbinas(orgId, fecha, codigoClave)
  if (!blob) return 0
  descargar(blob, nombrePdf('Prefrio', fecha))
  return 1
}

/** Consolidado por rango de fecha de entrada. Devuelve los días incluidos. */
export async function generarPrefrioTurbinasConsolidadoPDF(orgId: string, desde: string, hasta: string, codigoClave: string): Promise<number> {
  const { data, error } = await (supabase as any).from('m83_grupos').select('fecha').eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta).neq('estado', 'CANCELADO')
  if (error) throw error
  const fechas = Array.from(new Set((data ?? []).map((x: any) => x.fecha as string).filter(Boolean))).sort()
  const blobs: Blob[] = []
  for (const f of fechas) { const b = await blobPrefrioTurbinas(orgId, f as string, codigoClave); if (b) blobs.push(b) }
  if (blobs.length === 0) return 0
  descargar(await mergePDFBlobs(blobs), `Prefrio-consolidado-${desde}-${hasta}.pdf`)
  return blobs.length
}
