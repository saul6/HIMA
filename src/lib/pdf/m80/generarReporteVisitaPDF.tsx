// Descarga o vista previa del reporte de visita del Checklist v2 (M80).
// Fuente: chk_vis_reporte (snapshot inmutable) o chk_vis_preview (visita en curso).
import { pdf } from '@react-pdf/renderer'
import { obtenerFirmasParaPdf, firmasRegistroAParaPdf } from '@/hooks/useFirmasRegistro'
import { chk, type Reporte } from '@/hooks/useChecklistV2'
import { ReporteVisitaPDF } from './ReporteVisitaPDF'

// Nombre sin cliente ni instalación (CLAUDE.md §1)
const nombreArchivo = (fecha: string) => `checklist-visita-${fecha}.pdf`

async function construirBlob(reporte: Reporte, vistaPrevia: boolean): Promise<Blob> {
  const firmasMapa = vistaPrevia ? {} : await obtenerFirmasParaPdf('M80', [reporte.visita.id])
  const firmas = firmasRegistroAParaPdf((firmasMapa as Record<string, never>)[reporte.visita.id])
  return pdf(<ReporteVisitaPDF reporte={reporte} vistaPrevia={vistaPrevia} firmaRealizo={firmas.realizo} />).toBlob()
}

function descargar(blob: Blob, fecha: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo(fecha)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function generarReporteVisitaPDF(visitaId: string): Promise<void> {
  const reporte = await chk.visReporte(visitaId)
  descargar(await construirBlob(reporte, false), reporte.visita.fecha.slice(0, 10))
}

/** Vista previa de una visita en curso: abre el PDF marcado como no válido en otra pestaña. */
export async function previsualizarReporteVisitaPDF(reporte: Reporte): Promise<void> {
  // La pestaña se abre antes del await para que el navegador no la trate como ventana emergente
  const ventana = window.open('', '_blank')
  try {
    const blob = await construirBlob(reporte, true)
    const url = URL.createObjectURL(blob)
    if (ventana) ventana.location.href = url
    else descargar(blob, reporte.visita.fecha.slice(0, 10))
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    ventana?.close()
    throw e
  }
}
