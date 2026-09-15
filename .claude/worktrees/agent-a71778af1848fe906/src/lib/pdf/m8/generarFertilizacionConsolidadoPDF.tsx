// PATRÓN INOCUIDAD — generador PDF consolidado M8
// Una FertilizacionPagina por registro (rancho+fecha), agrupadas en un solo documento.

import { pdf } from '@react-pdf/renderer'
import { FertilizacionConsolidadoPDF, type FertilizacionPDFProps } from './FertilizacionPDF'

export async function generarFertilizacionConsolidadoPDF(
  registros: FertilizacionPDFProps[],
  ranchoNombre: string,
  desde: string,
  hasta: string
): Promise<void> {
  const desdeSlug = desde.replaceAll('-', '')
  const hastaSlug = hasta.replaceAll('-', '')
  const filename = `fertilizacion-consolidado-${desdeSlug}-${hastaSlug}.pdf`

  const blob = await pdf(
    <FertilizacionConsolidadoPDF
      registros={registros}
      ranchoNombre={ranchoNombre}
      desde={desde}
      hasta={hasta}
    />
  ).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
