import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { CalibracionBombasPDF, type BombaRow } from './CalibracionBombasPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'

function descargar(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function cargar(id: string, orgId: string) {
  const { data, error } = await (supabase as any)
    .from('m49_calibracion_bombas')
    .select('*, ranchos(nombre)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (error) throw error
  return data as any
}

function toRow(r: any): BombaRow {
  return {
    fecha: r.fecha,
    equipo: r.equipo,
    num_equipo: r.num_equipo,
    cultivo: r.cultivo,
    parcela: r.parcela,
    distancia_m: r.distancia_m,
    velocidad_kmh: r.velocidad_kmh,
    presion_bar: r.presion_bar,
    volumen_recolectado_ml: r.volumen_recolectado_ml,
    gasto_l: r.gasto_l,
    resultado: r.resultado ?? null,
    realizo: r.realizo,
    observaciones: r.observaciones ?? null,
  }
}

export async function generarCalibracionBombasPDF(id: string, orgId: string, codigoClave: string): Promise<void> {
  const r = await cargar(id, orgId)
  const rancho = r.ranchos?.nombre ?? '—'
  const blob = await pdf(
    <CalibracionBombasPDF rancho={rancho} desde={r.fecha} hasta={r.fecha} registros={[toRow(r)]} codigoClave={codigoClave} />
  ).toBlob()
  descargar(blob, nombrePdf('Calibracion_Bombas', r.fecha))
}

export async function generarCalibracionBombasConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  ranchoNombre: string,
  orgNombre?: string | null,
  codigoClave?: string,
): Promise<void> {
  let query = (supabase as any)
    .from('m49_calibracion_bombas')
    .select('*, ranchos(nombre)')
    .eq('org_id', orgId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })
  if (ranchoId) query = query.eq('rancho_id', ranchoId)

  const { data, error } = await query
  if (error) throw error
  if (!data?.length) throw new Error('Sin registros en el rango seleccionado')

  const blob = await pdf(
    <CalibracionBombasPDF
      rancho={ranchoNombre}
      orgNombre={orgNombre}
      desde={desde}
      hasta={hasta}
      registros={(data as any[]).map(toRow)}
      codigoClave={codigoClave ?? 'FRUS'}
    />
  ).toBlob()
  descargar(blob, nombrePdf('Calibracion_Bombas_consolidado', `${desde}_${hasta}`))
}
