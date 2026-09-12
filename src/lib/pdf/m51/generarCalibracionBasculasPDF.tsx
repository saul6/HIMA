import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { CalibracionBasculasPDF, type BasculaRow } from './CalibracionBasculasPDF'
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
    .from('m51_calibracion_basculas')
    .select('*, ranchos(nombre)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (error) throw error
  return data as any
}

function toRow(r: any): BasculaRow {
  return {
    fecha: r.fecha,
    uso_bascula: r.uso_bascula,
    pesa_patron_kg: r.pesa_patron_kg,
    punto_calibracion: r.punto_calibracion,
    peso_medido_kg: r.peso_medido_kg,
    desviacion: r.desviacion,
    dentro_tolerancia: r.dentro_tolerancia,
    realizo: r.realizo,
    observaciones: r.observaciones ?? null,
  }
}

export async function generarCalibracionBasculasPDF(id: string, orgId: string, codigoClave: string): Promise<void> {
  const r = await cargar(id, orgId)
  const rancho = r.ranchos?.nombre ?? '—'
  const blob = await pdf(
    <CalibracionBasculasPDF rancho={rancho} desde={r.fecha} hasta={r.fecha} registros={[toRow(r)]} codigoClave={codigoClave} />
  ).toBlob()
  descargar(blob, nombrePdf('Calibracion_Basculas', r.fecha))
}

export async function generarCalibracionBasculasConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  ranchoNombre: string,
  orgNombre?: string | null,
  codigoClave?: string,
): Promise<void> {
  let query = (supabase as any)
    .from('m51_calibracion_basculas')
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
    <CalibracionBasculasPDF
      rancho={ranchoNombre}
      orgNombre={orgNombre}
      desde={desde}
      hasta={hasta}
      registros={(data as any[]).map(toRow)}
      codigoClave={codigoClave ?? 'FRUS'}
    />
  ).toBlob()
  descargar(blob, nombrePdf('Calibracion_Basculas_consolidado', `${desde}_${hasta}`))
}
