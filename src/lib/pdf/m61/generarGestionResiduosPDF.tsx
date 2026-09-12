import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { GestionResiduosPDF, type GestionResiduosRow } from './GestionResiduosPDF'
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
    .from('m61_gestion_residuos')
    .select('*, ranchos(nombre)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (error) throw error
  return data as any
}

function toRow(r: any): GestionResiduosRow {
  return {
    fecha: r.fecha,
    fuente_residuo: r.fuente_residuo,
    descripcion: r.descripcion ?? null,
    clasificacion: r.clasificacion ?? null,
    destino_final: r.destino_final ?? null,
    cantidad: r.cantidad ?? null,
    realizo: r.realizo ?? null,
    observaciones: r.observaciones ?? null,
  }
}

export async function generarGestionResiduosPDF(id: string, orgId: string, _codigoClave: string): Promise<void> {
  const r = await cargar(id, orgId)
  const rancho = r.ranchos?.nombre ?? '—'
  const blob = await pdf(
    <GestionResiduosPDF rancho={rancho} desde={r.fecha} hasta={r.fecha} registros={[toRow(r)]} />
  ).toBlob()
  descargar(blob, nombrePdf('GestionResiduos', r.fecha))
}

export async function generarBlobGestionResiduos(id: string, orgId: string, _codigoClave: string): Promise<Blob> {
  const r = await cargar(id, orgId)
  return pdf(
    <GestionResiduosPDF rancho={r.ranchos?.nombre ?? '—'} desde={r.fecha} hasta={r.fecha} registros={[toRow(r)]} />
  ).toBlob()
}

export async function generarGestionResiduosConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  ranchoNombre: string,
  orgNombre?: string | null,
  _codigoClave?: string,
): Promise<void> {
  let query = (supabase as any)
    .from('m61_gestion_residuos')
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

  const registros: GestionResiduosRow[] = (data as any[]).map(toRow)

  const blob = await pdf(
    <GestionResiduosPDF
      rancho={ranchoNombre}
      orgNombre={orgNombre}
      desde={desde}
      hasta={hasta}
      registros={registros}
    />
  ).toBlob()
  descargar(blob, nombrePdf('GestionResiduos_consolidado', `${desde}_${hasta}`))
}
