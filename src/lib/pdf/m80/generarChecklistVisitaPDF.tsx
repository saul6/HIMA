// Genera el PDF del reporte de visita del Checklist (M80): descarga o vista previa.
// Los datos salen de la RPC chk_visita_reporte y las firmas de registro_firmas_ver (M80).

import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { obtenerFirmasParaPdf, firmasRegistroAParaPdf } from '@/hooks/useFirmasRegistro'
import { ChecklistVisitaPDF, type ReporteVisita } from './ChecklistVisitaPDF'

export interface OpcionesChecklistVisitaPDF {
  codigoClave?: string
  terminoSitio?: string
}

async function construirBlob(visitaId: string, opc: OpcionesChecklistVisitaPDF): Promise<{ blob: Blob; fecha: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('chk_visita_reporte', { p_visita: visitaId })
  if (error) throw new Error((error as { message?: string }).message ?? 'No se pudo cargar el reporte de la visita')
  const reporte = (Array.isArray(data) ? data[0] : data) as ReporteVisita | null
  if (!reporte) throw new Error('No se encontró el reporte de la visita')

  const firmasMapa = await obtenerFirmasParaPdf('M80', [visitaId])
  const firmas = firmasRegistroAParaPdf(firmasMapa[visitaId])

  const blob = await pdf(
    <ChecklistVisitaPDF
      reporte={reporte}
      codigoClave={opc.codigoClave}
      terminoSitio={opc.terminoSitio}
      firmaRealizo={firmas.realizo}
      firmaVerifico={firmas.verifico}
      firmaEnterado={firmas.enterado}
    />,
  ).toBlob()
  return { blob, fecha: reporte.visita.fecha.slice(0, 10) }
}

// Nombre sin sitio ni organización (CLAUDE.md §1)
const nombreArchivo = (fecha: string) => `checklist-visita-${fecha}.pdf`

export async function generarChecklistVisitaPDF(visitaId: string, opc: OpcionesChecklistVisitaPDF = {}): Promise<void> {
  const { blob, fecha } = await construirBlob(visitaId, opc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo(fecha)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Vista previa en otra pestaña (visita en curso). Si el navegador bloquea la pestaña, descarga. */
export async function previsualizarChecklistVisitaPDF(visitaId: string, opc: OpcionesChecklistVisitaPDF = {}): Promise<void> {
  // La pestaña se abre antes del await para que el navegador no la trate como ventana emergente
  const ventana = window.open('', '_blank')
  try {
    const { blob, fecha } = await construirBlob(visitaId, opc)
    const url = URL.createObjectURL(blob)
    if (ventana) {
      ventana.location.href = url
    } else {
      const a = document.createElement('a')
      a.href = url
      a.download = nombreArchivo(fecha)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    ventana?.close()
    throw e
  }
}
