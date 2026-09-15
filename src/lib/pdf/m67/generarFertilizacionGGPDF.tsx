import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { FertilizacionGGPDF, type FertilizacionGGRow } from './FertilizacionGGPDF'
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
    .from('m67_fertilizacion_gg')
    .select('*, ranchos(nombre)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (error) throw error
  return data as any
}

function toRow(r: any): FertilizacionGGRow {
  return {
    fecha: r.fecha,
    cultivo: r.cultivo,
    bloque: r.bloque ?? null,
    superficie_ha: r.superficie_ha ?? null,
    producto: r.producto,
    fabricante: r.fabricante ?? null,
    formula: r.formula ?? null,
    cantidad_total: r.cantidad_total ?? null,
    unidad: r.unidad ?? null,
    cantidad_ha: r.cantidad_ha ?? null,
    maquinaria: r.maquinaria ?? null,
    metodo_aplicacion: r.metodo_aplicacion ?? null,
    operario: r.operario ?? null,
    observaciones: r.observaciones ?? null,
  }
}

export async function generarFertilizacionGGPDF(id: string, orgId: string): Promise<void> {
  const r = await cargar(id, orgId)
  const rancho = r.ranchos?.nombre ?? '—'
  const blob = await pdf(
    <FertilizacionGGPDF
      rancho={rancho}
      desde={r.fecha}
      hasta={r.fecha}
      registros={[toRow(r)]}
    />
  ).toBlob()
  descargar(blob, nombrePdf('Aplicacion_Fertilizantes_REG18', r.fecha))
}

export async function generarBlobFertilizacionGG(id: string, orgId: string): Promise<Blob> {
  const r = await cargar(id, orgId)
  return pdf(
    <FertilizacionGGPDF
      rancho={r.ranchos?.nombre ?? '—'}
      desde={r.fecha}
      hasta={r.fecha}
      registros={[toRow(r)]}
    />
  ).toBlob()
}

export async function generarFertilizacionGGConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  ranchoNombre: string,
  orgNombre?: string | null,
): Promise<void> {
  let query = (supabase as any)
    .from('m67_fertilizacion_gg')
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
    <FertilizacionGGPDF
      rancho={ranchoNombre}
      orgNombre={orgNombre}
      desde={desde}
      hasta={hasta}
      registros={(data as any[]).map(toRow)}
    />
  ).toBlob()
  descargar(blob, nombrePdf('Aplicacion_Fertilizantes_REG18_consolidado', `${desde}_${hasta}`))
}
