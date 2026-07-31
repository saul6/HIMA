// Genera y descarga el PDF individual de una jornada M10.

import { pdf } from '@react-pdf/renderer'
import { CosechaLiberacionPDF, type CosechaLiberacionPaginaProps } from './CosechaLiberacionPDF'

export async function generarCosechaLiberacionPDF(
  props: CosechaLiberacionPaginaProps,
): Promise<void> {
  const fechaSlug = props.fecha.replaceAll('-', '')
  const filename = `cosecha-liberacion-${fechaSlug}.pdf`

  const blob = await pdf(<CosechaLiberacionPDF {...props} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
