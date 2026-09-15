// PATRÓN INOCUIDAD — generador PDF individual M7
// pdf(<VidrioPlasticoPDF {...props} />).toBlob() → createObjectURL → descarga → revoke

import { pdf } from '@react-pdf/renderer'
import { VidrioPlasticoPDF, type VidrioPlasticoPDFProps } from './VidrioPlasticoPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'

export async function generarVidrioPlasticoPDF(
  props: VidrioPlasticoPDFProps,
  ranchoNombre: string,
  fecha: string
): Promise<void> {
  const filename = nombrePdf('Vidrio_Plastico', fecha, ranchoNombre)

  const blob = await pdf(<VidrioPlasticoPDF {...props} />).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
