// Genera y descarga el PDF individual de un Reporte de Incidencias (M13).
// Toma el reporte ya cargado por el hook (incluye storage_path de cada foto),
// descarga + re-comprime las fotos a ~800px y produce el documento.

import { pdf } from '@react-pdf/renderer'
import { ReporteIncidenciasPDF, type ReporteIncidenciasPDFProps } from './ReporteIncidenciasPDF'
import { fotosADataUris } from './incidenciasPdfImagenes'
import type { M13ReporteConRancho } from '@/hooks/useM13Incidencias'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { obtenerFirmasParaPdf, firmasRegistroAParaPdf } from '@/hooks/useFirmasRegistro'

export async function generarReporteIncidenciasPDF(
  reporte: M13ReporteConRancho,
): Promise<void> {
  // Recolectar todos los storage_path del reporte
  const todosLosPaths = reporte.incidencias.flatMap((inc) =>
    inc.fotos.map((f) => f.storage_path)
  )

  // Descargar + comprimir todas las fotos en paralelo
  const [urisPorPath, firmasMapa] = await Promise.all([
    fotosADataUris(todosLosPaths),
    obtenerFirmasParaPdf('M13', [reporte.id]),
  ])
  const firmas = firmasRegistroAParaPdf(firmasMapa[reporte.id])

  // Construir props del componente PDF
  const props: ReporteIncidenciasPDFProps = {
    folio: reporte.id.slice(0, 8).toUpperCase(),
    rancho: reporte.rancho_nombre,
    ranchoCodigo: reporte.rancho_codigo,
    fecha: reporte.fecha,
    auditorNombre: reporte.auditor_nombre,
    incidencias: reporte.incidencias.map((inc) => ({
      orden: inc.orden,
      descripcion: inc.descripcion,
      dataUris: inc.fotos.map((f) => urisPorPath[f.storage_path] ?? ''),
    })),
    firmaRealizo: firmas.realizo,
    firmaVerifico: firmas.verifico,
    firmaEnterado: firmas.enterado,
  }

  const blob = await pdf(<ReporteIncidenciasPDF {...props} />).toBlob()

  const filename = nombrePdf('Reporte_Incidencias', reporte.fecha, reporte.rancho_nombre)

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Genera blob sin descargar (para BibliotecaHistorial / mergePDFBlobs).
export async function generarBlobReporteIncidencias(
  reporte: M13ReporteConRancho,
): Promise<Blob> {
  const todosLosPaths = reporte.incidencias.flatMap((inc) =>
    inc.fotos.map((f) => f.storage_path)
  )
  const [urisPorPath, firmasMapa] = await Promise.all([
    fotosADataUris(todosLosPaths),
    obtenerFirmasParaPdf('M13', [reporte.id]),
  ])
  const firmas = firmasRegistroAParaPdf(firmasMapa[reporte.id])

  const props: ReporteIncidenciasPDFProps = {
    folio: reporte.id.slice(0, 8).toUpperCase(),
    rancho: reporte.rancho_nombre,
    ranchoCodigo: reporte.rancho_codigo,
    fecha: reporte.fecha,
    auditorNombre: reporte.auditor_nombre,
    incidencias: reporte.incidencias.map((inc) => ({
      orden: inc.orden,
      descripcion: inc.descripcion,
      dataUris: inc.fotos.map((f) => urisPorPath[f.storage_path] ?? ''),
    })),
    firmaRealizo: firmas.realizo,
    firmaVerifico: firmas.verifico,
    firmaEnterado: firmas.enterado,
  }

  return pdf(<ReporteIncidenciasPDF {...props} />).toBlob()
}
