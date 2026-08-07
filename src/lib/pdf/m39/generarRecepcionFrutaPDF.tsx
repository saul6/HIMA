import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { RecepcionFrutaPDF, type M39RecepcionDataPDF, type M39LineaPDF } from './RecepcionFrutaPDF'
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

async function cargarDatos(id: string, orgId: string): Promise<M39RecepcionDataPDF> {
  const [recRes, linRes, orgRes] = await Promise.all([
    (supabase as any).from('m39_recepciones')
      .select('*, ranchos(nombre)')
      .eq('id', id)
      .eq('org_id', orgId)
      .single(),
    (supabase as any).from('m39_lineas')
      .select('*')
      .eq('recepcion_id', id)
      .eq('org_id', orgId)
      .order('orden'),
    (supabase as any).from('organizaciones')
      .select('nombre')
      .eq('id', orgId)
      .single(),
  ])
  if (recRes.error) throw recRes.error
  if (linRes.error) throw linRes.error

  const r = recRes.data as any
  const lineas: M39LineaPDF[] = ((linRes.data ?? []) as any[]).map((l) => ({
    orden: l.orden,
    hora: l.hora ?? null,
    codigo_productor: l.codigo_productor ?? null,
    tipo: l.tipo ?? 'convencional',
    pase_anden: l.pase_anden ?? false,
    producto: l.producto ?? null,
    cant_6oz: l.cant_6oz ?? null,
    cant_12oz: l.cant_12oz ?? null,
    cant_18oz: l.cant_18oz ?? null,
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

export async function generarRecepcionFrutaPDF(id: string, orgId: string): Promise<void> {
  const d = await cargarDatos(id, orgId)
  const blob = await pdf(<RecepcionFrutaPDF d={d} />).toBlob()
  descargar(blob, nombrePdf('Recepcion_Fruta', d.fecha, d.instalacion))
}

export async function generarBlobRecepcionFruta(id: string, orgId: string): Promise<Blob> {
  const d = await cargarDatos(id, orgId)
  return pdf(<RecepcionFrutaPDF d={d} />).toBlob()
}
