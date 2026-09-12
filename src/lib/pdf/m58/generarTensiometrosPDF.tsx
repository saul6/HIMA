import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { TensiometrosPDF, type TensiometrosRow } from './TensiometrosPDF'
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
    .from('m58_tensiometros')
    .select('*, ranchos(nombre)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (error) throw error
  return data as any
}

function toRow(r: any): TensiometrosRow {
  return {
    fecha: r.fecha,
    hora: r.hora ?? null,
    prof_15cm: r.prof_15cm ?? null,
    prof_45cm: r.prof_45cm ?? null,
    prof_otra_cm: r.prof_otra_cm ?? null,
    lectura_otra: r.lectura_otra ?? null,
    realizo: r.realizo ?? null,
    observaciones: r.observaciones ?? null,
  }
}

export async function generarTensiometrosPDF(id: string, orgId: string, _codigoClave: string): Promise<void> {
  const r = await cargar(id, orgId)
  const blob = await pdf(
    <TensiometrosPDF rancho={r.ranchos?.nombre ?? '—'} desde={r.fecha} hasta={r.fecha} registros={[toRow(r)]} />
  ).toBlob()
  descargar(blob, nombrePdf('Tensiometros', r.fecha))
}

export async function generarBlobTensiometros(id: string, orgId: string, _codigoClave: string): Promise<Blob> {
  const r = await cargar(id, orgId)
  return pdf(
    <TensiometrosPDF rancho={r.ranchos?.nombre ?? '—'} desde={r.fecha} hasta={r.fecha} registros={[toRow(r)]} />
  ).toBlob()
}

export async function generarTensiometrosConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  ranchoNombre: string,
  orgNombre?: string | null,
  _codigoClave?: string,
): Promise<void> {
  let query = (supabase as any)
    .from('m58_tensiometros')
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

  const registros: TensiometrosRow[] = (data as any[]).map(toRow)

  const blob = await pdf(
    <TensiometrosPDF
      rancho={ranchoNombre}
      orgNombre={orgNombre}
      desde={desde}
      hasta={hasta}
      registros={registros}
    />
  ).toBlob()
  descargar(blob, nombrePdf('Tensiometros_consolidado', `${desde}_${hasta}`))
}
