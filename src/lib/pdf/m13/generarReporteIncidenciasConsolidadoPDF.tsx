// Genera y descarga el PDF consolidado de Reportes de Incidencias (M13)
// para un rango de fechas, opcionalmente filtrado por rancho.

import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  ReporteIncidenciasConsolidadoPDF,
  type ReporteIncidenciasPDFProps,
} from './ReporteIncidenciasPDF'
import { fotosADataUris } from './incidenciasPdfImagenes'

export async function generarReporteIncidenciasConsolidadoPDF(
  orgId: string,
  desde: string,
  hasta: string,
  ranchoId?: string,
): Promise<void> {
  let query = supabase
    .from('m13_reportes')
    .select(`
      id, fecha, auditor_nombre,
      ranchos(nombre, codigo),
      m13_incidencias(
        id, orden, descripcion,
        m13_incidencia_fotos(id, storage_path, orden)
      )
    `)
    .eq('org_id', orgId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })

  if (ranchoId) {
    query = query.eq('rancho_id', ranchoId)
  }

  const { data, error } = await query
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No hay reportes en ese rango de fechas')
  }

  if (data.length > 5) {
    console.warn(`[M13 consolidado] Generando PDF con ${data.length} reportes — puede tardar varios segundos por la descarga de fotos.`)
  }

  // Recolectar todos los paths para descargarlos en paralelo de una vez
  const todosLosPaths: string[] = []
  for (const r of data) {
    for (const inc of (r.m13_incidencias ?? []) as any[]) {
      for (const f of (inc.m13_incidencia_fotos ?? []) as any[]) {
        todosLosPaths.push(f.storage_path)
      }
    }
  }

  const urisPorPath = await fotosADataUris(todosLosPaths)

  // Construir props por reporte
  const propsList: ReporteIncidenciasPDFProps[] = (data as any[]).map((r) => {
    const incidencias = ((r.m13_incidencias ?? []) as any[])
      .sort((a: any, b: any) => a.orden - b.orden)
      .map((inc: any) => ({
        orden: inc.orden,
        descripcion: inc.descripcion,
        dataUris: ((inc.m13_incidencia_fotos ?? []) as any[])
          .sort((a: any, b: any) => a.orden - b.orden)
          .map((f: any) => urisPorPath[f.storage_path] ?? ''),
      }))

    return {
      folio: (r.id as string).slice(0, 8).toUpperCase(),
      rancho: (r.ranchos as any)?.nombre ?? '—',
      ranchoCodigo: (r.ranchos as any)?.codigo ?? '—',
      fecha: r.fecha,
      auditorNombre: r.auditor_nombre ?? null,
      incidencias,
    }
  })

  const blob = await pdf(<ReporteIncidenciasConsolidadoPDF reportes={propsList} />).toBlob()

  const desdeSlug = desde.replaceAll('-', '')
  const hastaSlug = hasta.replaceAll('-', '')
  const filename = `reporte-incidencias-consolidado-${desdeSlug}-${hastaSlug}.pdf`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
