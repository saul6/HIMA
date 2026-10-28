// Enlaza los botones PDF con el generador correcto: visitas v2 (snapshot) o "Visita anterior" (checklist viejo).
import type { VisitaLista } from '@/hooks/useChecklistV2'

export async function descargarReportePdf(v: Pick<VisitaLista, 'id' | 'estado'>, codigoClave: string): Promise<void> {
  if (v.estado === 'realizada') {
    const { generarChecklistVisitaPDF } = await import('@/lib/pdf/m80/generarChecklistVisitaPDF')
    await generarChecklistVisitaPDF(v.id, { codigoClave })
    return
  }
  const { generarReporteVisitaPDF } = await import('@/lib/pdf/m80/generarReporteVisitaPDF')
  await generarReporteVisitaPDF(v.id)
}
