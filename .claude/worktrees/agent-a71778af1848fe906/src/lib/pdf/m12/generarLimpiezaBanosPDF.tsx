// Genera y descarga el PDF individual de una jornada M12.

import { pdf } from '@react-pdf/renderer'
import { LimpiezaBanosPDF, type LimpiezaBanosPaginaProps } from './LimpiezaBanosPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'

export async function generarLimpiezaBanosPDF(
  props: LimpiezaBanosPaginaProps,
): Promise<void> {
  const filename = nombrePdf('Limpieza_Banos', props.fecha, props.rancho)

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
