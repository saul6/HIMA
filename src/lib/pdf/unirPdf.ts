// Une varios PDF (Blob) en uno solo, en orden. Lo usan los consolidados por rango de M82–M86.
import { PDFDocument } from 'pdf-lib'

export async function mergePDFBlobs(blobs: Blob[]): Promise<Blob> {
  const merged = await PDFDocument.create()
  for (const blob of blobs) {
    const doc = await PDFDocument.load(await blob.arrayBuffer())
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach((page) => merged.addPage(page))
  }
  const bytes = await merged.save()
  return new Blob([bytes], { type: 'application/pdf' })
}
