import { pdf } from '@react-pdf/renderer'
import { VoucherPDF } from './VoucherPDF'
import { nomina } from '@/hooks/useNomina'
import type { VoucherData } from '@/types/nomina.types'

/** voucher-NOM-000123-2026-10-26.pdf (sin nombre del trabajador ni de la organización). */
export const nombreArchivoVoucher = (v: VoucherData) => `voucher-${v.folio}-${v.periodo.inicio}.pdf`

function descargar(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function generarVoucherBlob(voucher: VoucherData): Promise<Blob> {
  return pdf(<VoucherPDF voucher={voucher} />).toBlob()
}

/** Pide el voucher al servidor (crea una revisión nueva solo si cambió el estado de pago) y lo descarga. */
export async function generarVoucherPDF(corteId: string): Promise<void> {
  const voucher = await nomina.voucher(corteId)
  descargar(await generarVoucherBlob(voucher), nombreArchivoVoucher(voucher))
}

/** Un voucher por corte aprobado, unidos en un solo PDF. */
export async function generarVouchersSemanaPDF(corteIds: string[], inicio: string): Promise<void> {
  const { mergePDFBlobs } = await import('@/lib/pdf/generarBlobHistorial')
  const blobs: Blob[] = []
  for (const id of corteIds) {
    blobs.push(await generarVoucherBlob(await nomina.voucher(id)))
  }
  descargar(await mergePDFBlobs(blobs), `vouchers-${inicio}.pdf`)
}
