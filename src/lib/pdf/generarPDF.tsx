import { pdf } from '@react-pdf/renderer'
import { AplicacionPDF } from './AplicacionPDF'
import type { AplicacionPDFProps } from './AplicacionPDF'
import { AplicacionGlobalGapPDF } from './AplicacionGlobalGapPDF'
import { nombrePdf } from './nombrePdf'

export async function generarAplicacionPDF(
  props: AplicacionPDFProps & { esCampo?: boolean }
): Promise<void> {
  const { aplicacion, rancho, esCampo, ...rest } = props

  const filename = nombrePdf('Aplicacion', aplicacion.fecha_aplicacion, rancho?.nombre)

  const pdfProps: AplicacionPDFProps = { aplicacion, rancho, ...rest }

  const blob = await pdf(
    esCampo
      ? <AplicacionGlobalGapPDF {...pdfProps} />
      : <AplicacionPDF {...pdfProps} />
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
