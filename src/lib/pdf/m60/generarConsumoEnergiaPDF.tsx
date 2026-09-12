import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { ConsumoEnergiaPDF, type ConsumoEnergiaRow } from './ConsumoEnergiaPDF'
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
    .from('m60_consumo_energia')
    .select('*, ranchos(nombre)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (error) throw error
  return data as any
}

function toRow(r: any): ConsumoEnergiaRow {
  return {
    mes: r.mes,
    tipo_combustible: r.tipo_combustible ?? null,
    cantidad_litros: r.cantidad_litros ?? null,
    costo_combustible: r.costo_combustible ?? null,
    actividad: r.actividad ?? null,
    luz_costo: r.luz_costo ?? null,
    luz_kwh: r.luz_kwh ?? null,
    realizo: r.realizo ?? null,
    observaciones: r.observaciones ?? null,
  }
}

export async function generarConsumoEnergiaPDF(id: string, orgId: string, _codigoClave: string): Promise<void> {
  const r = await cargar(id, orgId)
  const rancho = r.ranchos?.nombre ?? '—'
  const blob = await pdf(
    <ConsumoEnergiaPDF rancho={rancho} desde={r.mes} hasta={r.mes} registros={[toRow(r)]} />
  ).toBlob()
  descargar(blob, nombrePdf('ConsumoEnergia', r.mes))
}

export async function generarBlobConsumoEnergia(id: string, orgId: string, _codigoClave: string): Promise<Blob> {
  const r = await cargar(id, orgId)
  return pdf(
    <ConsumoEnergiaPDF rancho={r.ranchos?.nombre ?? '—'} desde={r.mes} hasta={r.mes} registros={[toRow(r)]} />
  ).toBlob()
}

export async function generarConsumoEnergiaConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  ranchoNombre: string,
  orgNombre?: string | null,
  _codigoClave?: string,
): Promise<void> {
  let query = (supabase as any)
    .from('m60_consumo_energia')
    .select('*, ranchos(nombre)')
    .eq('org_id', orgId)
    .gte('mes', desde)
    .lte('mes', hasta)
    .order('mes', { ascending: true })
    .order('created_at', { ascending: true })
  if (ranchoId) query = query.eq('rancho_id', ranchoId)

  const { data, error } = await query
  if (error) throw error
  if (!data?.length) throw new Error('Sin registros en el rango seleccionado')

  const registros: ConsumoEnergiaRow[] = (data as any[]).map(toRow)

  const blob = await pdf(
    <ConsumoEnergiaPDF
      rancho={ranchoNombre}
      orgNombre={orgNombre}
      desde={desde}
      hasta={hasta}
      registros={registros}
    />
  ).toBlob()
  descargar(blob, nombrePdf('ConsumoEnergia_consolidado', `${desde}_${hasta}`))
}
