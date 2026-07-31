// Genera y descarga el PDF individual de una jornada M12.

import { pdf } from '@react-pdf/renderer'
import { LimpiezaBanosPDF, type LimpiezaBanosPaginaProps } from './LimpiezaBanosPDF'

export async function generarLimpiezaBanosPDF(
  props: LimpiezaBanosPaginaProps,
): Promise<void> {
  const fechaSlug = props.fecha.replaceAll('-', '')
  const filename = `limpieza-banos-${fechaSlug}.pdf`

  const blob = await pdf(<LimpiezaBanosPDF {...props} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
