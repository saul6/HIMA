// Genera y descarga el PDF individual de una jornada M12.

import { pdf } from '@react-pdf/renderer'
import { LimpiezaBanosPDF, type LimpiezaBanosPaginaProps } from './LimpiezaBanosPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { obtenerFirmasDeFilasParaPdf } from '@/hooks/useFirmasRegistro'

export async function generarLimpiezaBanosPDF(
  props: LimpiezaBanosPaginaProps,
  ids: string[] = [],
): Promise<void> {
  // Las firmas se consultan en la BD (no del estado de la pantalla), en todas las filas de la jornada
  let firmas: Pick<LimpiezaBanosPaginaProps, 'firmaRealizo' | 'firmaVerifico'> = {}
  if (ids.length > 0) {
    try { firmas = await obtenerFirmasDeFilasParaPdf('M12', ids) } catch { /* PDF sin firma */ }
  }

  const filename = nombrePdf('Limpieza_Banos', props.fecha, props.rancho)

  const blob = await pdf(<LimpiezaBanosPDF {...props} {...firmas} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
