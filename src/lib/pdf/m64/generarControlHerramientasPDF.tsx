import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { ControlHerramientasPDF, type ControlHerramientasRow } from './ControlHerramientasPDF'
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
    .from('m64_control_herramientas')
    .select('*, ranchos(nombre)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (error) throw error
  return data as any
}

function toRow(r: any): ControlHerramientasRow {
  return {
    fecha: r.fecha,
    rancho: r.ranchos?.nombre ?? '—',
    trabajador: r.trabajador,
    herramienta: r.herramienta,
    cantidad: r.cantidad,
    entrega_nombre: r.entrega_nombre,
    recibe_nombre: r.recibe_nombre,
    devuelto: r.devuelto,
    fecha_devolucion: r.fecha_devolucion ?? null,
    realizo: r.realizo ?? null,
    observaciones: r.observaciones ?? null,
  }
}

export async function generarControlHerramientasPDF(id: string, orgId: string, codigoClave: string): Promise<void> {
  const r = await cargar(id, orgId)
  const blob = await pdf(
    <ControlHerramientasPDF rows={[toRow(r)]} desde={r.fecha} hasta={r.fecha} codigoClave={codigoClave} />
  ).toBlob()
  descargar(blob, nombrePdf('Control_Herramientas', r.fecha))
}

export async function generarBlobControlHerramientas(id: string, orgId: string, codigoClave: string): Promise<Blob> {
  const r = await cargar(id, orgId)
  return pdf(
    <ControlHerramientasPDF rows={[toRow(r)]} desde={r.fecha} hasta={r.fecha} codigoClave={codigoClave} />
  ).toBlob()
}

export async function generarControlHerramientasConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  ranchoNombre: string,
  orgNombre?: string | null,
  codigoClave?: string,
): Promise<void> {
  let query = (supabase as any)
    .from('m64_control_herramientas')
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

  const rows: ControlHerramientasRow[] = (data as any[]).map(toRow)

  const blob = await pdf(
    <ControlHerramientasPDF
      rows={rows}
      orgNombre={orgNombre}
      desde={desde}
      hasta={hasta}
      codigoClave={codigoClave ?? 'FRUS'}
    />
  ).toBlob()
  descargar(blob, nombrePdf('Control_Herramientas_consolidado', `${desde}_${hasta}`))
}
