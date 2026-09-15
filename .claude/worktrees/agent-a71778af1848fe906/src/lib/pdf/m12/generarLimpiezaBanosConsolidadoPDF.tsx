// Genera y descarga el PDF consolidado M12 (varias jornadas de un rancho).

import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { LimpiezaBanosConsolidadoPDF, type LimpiezaBanosPaginaProps } from './LimpiezaBanosPDF'

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export async function generarLimpiezaBanosConsolidadoPDF(
  ranchoId: string,
  ranchoNombre: string,
  orgId: string,
  desde: string,
  hasta: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('m12_limpieza_banos')
    .select('*, ranchos(nombre, codigo)')
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

  // Agrupar por fecha para formar jornadas
  const jornadasMap = new Map<string, LimpiezaBanosPaginaProps>()
  for (const row of data) {
    const key = row.fecha
    if (!jornadasMap.has(key)) {
      jornadasMap.set(key, {
        rancho: (row as any).ranchos?.nombre ?? ranchoNombre,
        ranchoCodigo: (row as any).ranchos?.codigo ?? '—',
        fecha: row.fecha,
        banos: [],
      })
    }
    jornadasMap.get(key)!.banos.push({
      bano_numero: row.bano_numero,
      limpieza: row.limpieza,
      desinfeccion: row.desinfeccion,
      concentracion_ppm: row.concentracion_ppm,
      sustancias: row.sustancias ?? [],
      abasto_papel: row.abasto_papel,
      succion: row.succion,
    })
  }

  const jornadas = Array.from(jornadasMap.values())
  const desdeSlug = desde.replaceAll('-', '')
  const hastaSlug = hasta.replaceAll('-', '')
  const filename = `limpieza-banos-consolidado-${desdeSlug}-${hastaSlug}.pdf`

  const blob = await pdf(
    <LimpiezaBanosConsolidadoPDF
      jornadas={jornadas}
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
