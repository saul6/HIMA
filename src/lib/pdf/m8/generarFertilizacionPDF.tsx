// PATRÓN INOCUIDAD — generador PDF individual M8
// pdf(<FertilizacionPDF {...props} {...firmas} />).toBlob() → createObjectURL → descarga → revoke

import { pdf } from '@react-pdf/renderer'
import { FertilizacionPDF, type FertilizacionPDFProps } from './FertilizacionPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { obtenerFirmasDeFilasParaPdf } from '@/hooks/useFirmasRegistro'

export async function generarFertilizacionPDF(
  props: FertilizacionPDFProps,
  ranchoNombre: string,
  fecha: string,
  ids: string[] = [],
): Promise<void> {
  // Las firmas se consultan en la BD, en todas las filas del registro
  let firmas = {}
  if (ids.length > 0) {
    try { firmas = await obtenerFirmasDeFilasParaPdf('M8', ids) } catch { /* PDF sin firma */ }
  }

  const filename = nombrePdf('Fertilizacion', fecha, ranchoNombre)

  const blob = await pdf(<FertilizacionPDF {...props} {...firmas} />).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
