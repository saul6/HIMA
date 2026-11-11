import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { ManifiestoPorTarimaPDF } from './ManifiestoPorTarimaPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { cargarDetalleM86 } from '@/hooks/useM86Manifiesto'

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

export async function generarManifiestoPorTarimaPDF(id: string, orgId: string, codigoClave: string): Promise<void> {
  const [d, o] = await Promise.all([
    cargarDetalleM86(id),
    (supabase as any).from('organizaciones').select('nombre').eq('id', orgId).single(),
  ])
  const blob = await pdf(<ManifiestoPorTarimaPDF d={d} orgNombre={o.data?.nombre ?? ''} codigoClave={codigoClave} />).toBlob()
  descargar(blob, nombrePdf('Manifiesto_Embarque', d.m.fecha))
}
