// Genera y descarga el PDF individual de un Reporte de Incidencias (M13).
// Toma el reporte ya cargado por el hook (incluye storage_path de cada foto),
// descarga + re-comprime las fotos a ~800px y produce el documento.

import { pdf } from '@react-pdf/renderer'
import { ReporteIncidenciasPDF, type ReporteIncidenciasPDFProps } from './ReporteIncidenciasPDF'
import { fotosADataUris } from './incidenciasPdfImagenes'
import type { M13ReporteConRancho } from '@/hooks/useM13Incidencias'

export async function generarReporteIncidenciasPDF(
  reporte: M13ReporteConRancho,
): Promise<void> {
  // Recolectar todos los storage_path del reporte
  const todosLosPaths = reporte.incidencias.flatMap((inc) =>
    inc.fotos.map((f) => f.storage_path)
  )

  // Descargar + comprimir todas las fotos en paralelo
  const urisPorPath = await fotosADataUris(todosLosPaths)

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
  }

  const blob = await pdf(<ReporteIncidenciasPDF {...props} />).toBlob()

  const fechaSlug = reporte.fecha.replaceAll('-', '')
  const filename = `reporte-incidencias-${fechaSlug}.pdf`

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
  const urisPorPath = await fotosADataUris(todosLosPaths)

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
  }

  return pdf(<ReporteIncidenciasPDF {...props} />).toBlob()
}
