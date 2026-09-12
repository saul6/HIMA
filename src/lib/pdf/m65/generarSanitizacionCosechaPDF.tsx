import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { SanitizacionCosechaPDF, type SanitizacionCosechaRow } from './SanitizacionCosechaPDF'
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
    .from('m65_sanitizacion_cosecha')
    .select('*, ranchos(nombre)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (error) throw error
  return data as any
}

function toRow(r: any): SanitizacionCosechaRow {
  return {
    fecha: r.fecha,
    rancho: r.ranchos?.nombre ?? '—',
    sector: r.sector,
    empaque_o_granel: r.empaque_o_granel,
    cantidad_ton: r.cantidad_ton,
    canastos: r.canastos,
    herramientas_sanitizadas: r.herramientas_sanitizadas,
    producto_sanitizante: r.producto_sanitizante,
    ppm: r.ppm,
    hora: r.hora ?? null,
    realizo: r.realizo ?? null,
    observaciones: r.observaciones ?? null,
  }
}

export async function generarSanitizacionCosechaPDF(id: string, orgId: string, codigoClave: string): Promise<void> {
  const r = await cargar(id, orgId)
  const blob = await pdf(
    <SanitizacionCosechaPDF rows={[toRow(r)]} desde={r.fecha} hasta={r.fecha} codigoClave={codigoClave} />
  ).toBlob()
  descargar(blob, nombrePdf('Sanitizacion_Cosecha', r.fecha))
}

export async function generarBlobSanitizacionCosecha(id: string, orgId: string, codigoClave: string): Promise<Blob> {
  const r = await cargar(id, orgId)
  return pdf(
    <SanitizacionCosechaPDF rows={[toRow(r)]} desde={r.fecha} hasta={r.fecha} codigoClave={codigoClave} />
  ).toBlob()
}

export async function generarSanitizacionCosechaConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  ranchoNombre: string,
  orgNombre?: string | null,
  codigoClave?: string,
): Promise<void> {
  let query = (supabase as any)
    .from('m65_sanitizacion_cosecha')
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

  const rows: SanitizacionCosechaRow[] = (data as any[]).map(toRow)

  const blob = await pdf(
    <SanitizacionCosechaPDF
      rows={rows}
      orgNombre={orgNombre}
      desde={desde}
      hasta={hasta}
      codigoClave={codigoClave ?? 'FRUS'}
    />
  ).toBlob()
  descargar(blob, nombrePdf('Sanitizacion_Cosecha_consolidado', `${desde}_${hasta}`))
}
