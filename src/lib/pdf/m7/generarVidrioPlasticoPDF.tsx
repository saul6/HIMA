// PATRÓN INOCUIDAD — generador PDF individual M7
// pdf(<VidrioPlasticoPDF {...props} {...firmas} />).toBlob() → createObjectURL → descarga → revoke

import { pdf } from '@react-pdf/renderer'
import { VidrioPlasticoPDF, type VidrioPlasticoPDFProps } from './VidrioPlasticoPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { obtenerFirmasDeFilasParaPdf } from '@/hooks/useFirmasRegistro'

export async function generarVidrioPlasticoPDF(
  props: VidrioPlasticoPDFProps,
  ranchoNombre: string,
  fecha: string,
  ids: string[] = [],
): Promise<void> {
  // Las firmas se consultan en la BD, en todas las filas del registro
  let firmas = {}
  if (ids.length > 0) {
    try { firmas = await obtenerFirmasDeFilasParaPdf('M7', ids) } catch { /* PDF sin firma */ }
  }

  const filename = nombrePdf('Vidrio_Plastico', fecha, ranchoNombre)

  const blob = await pdf(<VidrioPlasticoPDF {...props} {...firmas} />).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
