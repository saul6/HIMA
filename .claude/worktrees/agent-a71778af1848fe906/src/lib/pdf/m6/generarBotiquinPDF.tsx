// PATRÓN INOCUIDAD — generador PDF M6
// M7-M12 replican este archivo en src/lib/pdf/m<N>/generar<Modulo>PDF.tsx:
//   pdf(<Componente {...props} />).toBlob() → createObjectURL → click → revokeObjectURL

import { pdf } from '@react-pdf/renderer'
import { BotiquinPDF, type BotiquinPDFProps } from './BotiquinPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'

export async function generarBotiquinPDF(
  props: BotiquinPDFProps,
  ranchoNombre: string,
  fecha: string
): Promise<void> {
  const filename = nombrePdf('Botiquin', fecha, ranchoNombre)

  const blob = await pdf(<BotiquinPDF {...props} />).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
