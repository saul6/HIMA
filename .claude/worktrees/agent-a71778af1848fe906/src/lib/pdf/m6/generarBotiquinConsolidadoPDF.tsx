// PATRÓN INOCUIDAD — generador PDF consolidado M6
// Mismo patrón que generarBotiquinPDF.tsx pero para el documento multi-página.

import { pdf } from '@react-pdf/renderer'
import { BotiquinConsolidadoPDF, type BotiquinPDFProps } from './BotiquinPDF'

export async function generarBotiquinConsolidadoPDF(
  registros: BotiquinPDFProps[],
  ranchoNombre: string,
  desde: string,
  hasta: string
): Promise<void> {
  const desdeSlug = desde.replaceAll('-', '')
  const hastaSlug = hasta.replaceAll('-', '')
  const filename = `botiquin-consolidado-${desdeSlug}-${hastaSlug}.pdf`

  const blob = await pdf(
    <BotiquinConsolidadoPDF registros={registros} ranchoNombre={ranchoNombre} desde={desde} hasta={hasta} />
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
