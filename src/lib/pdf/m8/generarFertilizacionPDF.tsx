// PATRÓN INOCUIDAD — generador PDF individual M8
// pdf(<FertilizacionPDF {...props} />).toBlob() → createObjectURL → descarga → revoke

import { pdf } from '@react-pdf/renderer'
import { FertilizacionPDF, type FertilizacionPDFProps } from './FertilizacionPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'

export async function generarFertilizacionPDF(
  props: FertilizacionPDFProps,
  ranchoNombre: string,
  fecha: string
): Promise<void> {
  const filename = nombrePdf('Fertilizacion', fecha, ranchoNombre)

  const blob = await pdf(<FertilizacionPDF {...props} />).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
