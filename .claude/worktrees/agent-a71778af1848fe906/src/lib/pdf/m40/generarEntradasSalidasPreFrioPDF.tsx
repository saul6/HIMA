import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { EntradasSalidasPreFrioPDF, type M40RegistroDataPDF, type M40LineaPDF } from './EntradasSalidasPreFrioPDF'
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

async function cargarDatos(id: string, orgId: string): Promise<M40RegistroDataPDF> {
  const [regRes, linRes, orgRes] = await Promise.all([
    (supabase as any).from('m40_registros')
      .select('*, ranchos(nombre)')
      .eq('id', id)
      .eq('org_id', orgId)
      .single(),
    (supabase as any).from('m40_lineas')
      .select('*')
      .eq('registro_id', id)
      .eq('org_id', orgId)
      .order('orden'),
    (supabase as any).from('organizaciones')
      .select('nombre')
      .eq('id', orgId)
      .single(),
  ])
  if (regRes.error) throw regRes.error
  if (linRes.error) throw linRes.error

  const r = regRes.data as any
  const lineas: M40LineaPDF[] = ((linRes.data ?? []) as any[]).map((l) => ({
    orden: l.orden,
    cuarto_prefrio: l.cuarto_prefrio ?? null,
    fruta: l.fruta ?? null,
    presentacion: l.presentacion ?? null,
    num_tarimas: l.num_tarimas ?? null,
    restos: l.restos ?? null,
    entrada_hora: l.entrada_hora ?? null,
    entrada_temp: l.entrada_temp ?? null,
    salida_hora: l.salida_hora ?? null,
    salida_temp: l.salida_temp ?? null,
    tiempo_total: l.tiempo_total ?? null,
  }))

  return {
    orgNombre: orgRes.data?.nombre ?? '—',
    instalacion: r.ranchos?.nombre ?? '—',
    fecha: r.fecha,
    empresa: r.empresa ?? null,
    observaciones: r.observaciones ?? null,
    lineas,
  }
}

export async function generarEntradasSalidasPreFrioPDF(id: string, orgId: string, codigoClave: string): Promise<void> {
  const d = await cargarDatos(id, orgId)
  const blob = await pdf(<EntradasSalidasPreFrioPDF d={d} codigoClave={codigoClave} />).toBlob()
  descargar(blob, nombrePdf('Entradas_Salidas_Prefrio', d.fecha, d.instalacion))
}

export async function generarBlobEntradasSalidasPreFrio(id: string, orgId: string, codigoClave: string): Promise<Blob> {
  const d = await cargarDatos(id, orgId)
  return pdf(<EntradasSalidasPreFrioPDF d={d} codigoClave={codigoClave} />).toBlob()
}
