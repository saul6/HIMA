// PATRÓN INOCUIDAD — generador PDF consolidado M7
// Una VidrioPlasticoPagina por inspección (rancho+fecha), agrupadas en un solo documento.

import { pdf } from '@react-pdf/renderer'
import { VidrioPlasticoConsolidadoPDF, type VidrioPlasticoPDFProps } from './VidrioPlasticoPDF'

export async function generarVidrioPlasticoConsolidadoPDF(
  inspecciones: VidrioPlasticoPDFProps[],
  ranchoNombre: string,
  desde: string,
  hasta: string
): Promise<void> {
  const desdeSlug = desde.replaceAll('-', '')
  const hastaSlug = hasta.replaceAll('-', '')
  const filename = `vidrio-plastico-consolidado-${desdeSlug}-${hastaSlug}.pdf`

  const blob = await pdf(
    <VidrioPlasticoConsolidadoPDF
      inspecciones={inspecciones}
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
