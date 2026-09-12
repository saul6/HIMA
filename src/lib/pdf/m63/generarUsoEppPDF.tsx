import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { UsoEppPDF, type UsoEppRow } from './UsoEppPDF'
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
    .from('m63_uso_epp')
    .select('*, ranchos(nombre)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (error) throw error
  return data as any
}

function toRow(r: any): UsoEppRow {
  return {
    fecha: r.fecha,
    rancho: r.ranchos?.nombre ?? '—',
    aplicador: r.aplicador,
    momento: r.momento,
    botas_ok: r.botas_ok,
    overol_ok: r.overol_ok,
    guantes_ok: r.guantes_ok,
    lentes_ok: r.lentes_ok,
    mascarilla_ok: r.mascarilla_ok,
    realizo: r.realizo ?? null,
    observaciones: r.observaciones ?? null,
  }
}

export async function generarUsoEppPDF(id: string, orgId: string, codigoClave: string): Promise<void> {
  const r = await cargar(id, orgId)
  const blob = await pdf(
    <UsoEppPDF rows={[toRow(r)]} desde={r.fecha} hasta={r.fecha} codigoClave={codigoClave} />
  ).toBlob()
  descargar(blob, nombrePdf('Uso_EPP', r.fecha))
}

export async function generarBlobUsoEpp(id: string, orgId: string, codigoClave: string): Promise<Blob> {
  const r = await cargar(id, orgId)
  return pdf(
    <UsoEppPDF rows={[toRow(r)]} desde={r.fecha} hasta={r.fecha} codigoClave={codigoClave} />
  ).toBlob()
}

export async function generarUsoEppConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  ranchoNombre: string,
  orgNombre?: string | null,
  codigoClave?: string,
): Promise<void> {
  let query = (supabase as any)
    .from('m63_uso_epp')
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

  const rows: UsoEppRow[] = (data as any[]).map(toRow)

  const blob = await pdf(
    <UsoEppPDF
      rows={rows}
      orgNombre={orgNombre}
      desde={desde}
      hasta={hasta}
      codigoClave={codigoClave ?? 'FRUS'}
    />
  ).toBlob()
  descargar(blob, nombrePdf('Uso_EPP_consolidado', `${desde}_${hasta}`))
}
