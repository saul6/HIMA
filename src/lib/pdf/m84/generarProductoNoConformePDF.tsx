import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { ProductoNoConformePDF } from './ProductoNoConformePDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import type { M84Papeleta } from '@/hooks/useM84NoConforme'

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

/** Una o varias papeletas (una hoja por papeleta) como Blob. */
export async function blobProductoNoConforme(papeletas: M84Papeleta[], orgId: string, codigoClave: string): Promise<Blob> {
  const { data } = await (supabase as any).from('organizaciones').select('nombre').eq('id', orgId).single()
  return pdf(<ProductoNoConformePDF papeletas={papeletas} orgNombre={data?.nombre ?? ''} codigoClave={codigoClave} />).toBlob()
}

export async function blobPapeletaM84(id: string, orgId: string, codigoClave: string): Promise<Blob> {
  const { data, error } = await (supabase as any).from('m84_papeletas').select('*').eq('id', id).single()
  if (error) throw error
  return blobProductoNoConforme([data as M84Papeleta], orgId, codigoClave)
}

/** Descarga una o varias papeletas (una hoja por papeleta). */
export async function generarProductoNoConformePDF(papeletas: M84Papeleta[], orgId: string, codigoClave: string): Promise<void> {
  if (papeletas.length === 0) return
  descargar(await blobProductoNoConforme(papeletas, orgId, codigoClave), nombrePdf('Producto_No_Conforme', papeletas[0].fecha))
}

/** Consolidado por rango (fecha de la papeleta): todas las papeletas, una hoja cada una. Devuelve cuántas. */
export async function generarProductoNoConformeConsolidadoPDF(orgId: string, desde: string, hasta: string, codigoClave: string): Promise<number> {
  const { data, error } = await (supabase as any).from('m84_papeletas').select('*').eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
    .order('fecha').order('retenida_en')
  if (error) throw error
  const ps = (data ?? []) as M84Papeleta[]
  if (ps.length === 0) return 0
  descargar(await blobProductoNoConforme(ps, orgId, codigoClave), `Producto_No_Conforme-consolidado-${desde}-${hasta}.pdf`)
  return ps.length
}
