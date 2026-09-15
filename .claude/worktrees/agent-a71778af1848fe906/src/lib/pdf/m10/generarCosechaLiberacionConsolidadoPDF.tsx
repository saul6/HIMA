// Genera y descarga el PDF consolidado M10 (varias jornadas de un rancho en un rango de fechas).

import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  CosechaLiberacionConsolidadoPDF,
  type CosechaLiberacionPaginaProps,
} from './CosechaLiberacionPDF'

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export async function generarCosechaLiberacionConsolidadoPDF(
  ranchoId: string,
  ranchoNombre: string,
  orgId: string,
  desde: string,
  hasta: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('m10_cosecha_liberacion')
    .select('*, ranchos(nombre, codigo), encargado:profiles!encargado_liberacion_id(nombre_completo)')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No hay registros en ese rango para el rancho seleccionado')
  }

  // Agrupar por fecha para formar jornadas (una página por jornada)
  const jornadasMap = new Map<string, CosechaLiberacionPaginaProps>()
  for (const row of data) {
    const key = row.fecha
    if (!jornadasMap.has(key)) {
      jornadasMap.set(key, {
        rancho: (row as any).ranchos?.nombre ?? ranchoNombre,
        ranchoCodigo: (row as any).ranchos?.codigo ?? '—',
        fecha: row.fecha,
        liberaciones: [],
      })
    }
    jornadasMap.get(key)!.liberaciones.push({
      sector: row.sector,
      cantidad_bandejas: row.cantidad_bandejas,
      lote_liberado: row.lote_liberado,
      numero_comprobante: row.numero_comprobante,
      codigo_trazabilidad: row.codigo_trazabilidad,
      marca_embalaje: row.marca_embalaje,
      destino_final: row.destino_final,
      fruta_proceso_kg: row.fruta_proceso_kg,
      encargado_nombre: (row as any).encargado?.nombre_completo ?? null,
      verificacion_semanal: row.verificacion_semanal,
      hora_inicio_cosecha: row.hora_inicio_cosecha,
      hora_fin_cosecha: row.hora_fin_cosecha,
      observaciones: row.observaciones,
    })
  }

  const registros = Array.from(jornadasMap.values())
  const desdeSlug = desde.replaceAll('-', '')
  const hastaSlug = hasta.replaceAll('-', '')
  const filename = `cosecha-liberacion-consolidado-${desdeSlug}-${hastaSlug}.pdf`

  const blob = await pdf(
    <CosechaLiberacionConsolidadoPDF
      registros={registros}
      ranchoNombre={ranchoNombre}
      desde={desde}
      hasta={hasta}
    />
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
