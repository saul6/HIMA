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

/** Descarga una o varias papeletas (una hoja por papeleta). */
export async function generarProductoNoConformePDF(papeletas: M84Papeleta[], orgId: string, codigoClave: string): Promise<void> {
  if (papeletas.length === 0) return
  const { data } = await (supabase as any).from('organizaciones').select('nombre').eq('id', orgId).single()
  const blob = await pdf(<ProductoNoConformePDF papeletas={papeletas} orgNombre={data?.nombre ?? ''} codigoClave={codigoClave} />).toBlob()
  descargar(blob, nombrePdf('Producto_No_Conforme', papeletas[0].fecha))
}
