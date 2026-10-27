import { pdf } from '@react-pdf/renderer'
import { ConsolidadoMensualPDF } from './ConsolidadoMensualPDF'
import type { ConsolidadoGuardado } from '@/types/nomina.types'

/** consolidado-mensual-2026-09-R2.pdf (sin nombre de la organización ni de trabajadores). */
export const nombreArchivoConsolidadoPDF = (c: Pick<ConsolidadoGuardado, 'datos' | 'revision'>) =>
  `consolidado-mensual-${c.datos.mes}-R${c.revision}.pdf`

export async function generarConsolidadoMensualPDF(consolidado: ConsolidadoGuardado): Promise<void> {
  const blob = await pdf(<ConsolidadoMensualPDF consolidado={consolidado} />).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nombreArchivoConsolidadoPDF(consolidado)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
