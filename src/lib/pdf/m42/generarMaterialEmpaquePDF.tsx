import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { MaterialEmpaquePDF, type M42MovimientoPDF } from './MaterialEmpaquePDF'
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

async function cargarDatos(id: string, orgId: string): Promise<M42MovimientoPDF> {
  const [movRes, orgRes] = await Promise.all([
    (supabase as any).from('m42_movimientos')
      .select('*, ranchos(nombre)')
      .eq('id', id).eq('org_id', orgId).single(),
    (supabase as any).from('organizaciones')
      .select('nombre').eq('id', orgId).single(),
  ])
  if (movRes.error) throw movRes.error

  const r = movRes.data as any
  return {
    orgNombre: orgRes.data?.nombre ?? '—',
    instalacion: r.ranchos?.nombre ?? '—',
    empresa: r.empresa ?? null,
    fecha: r.fecha,
    descripcion_material: r.descripcion_material ?? null,
    entrada: r.entrada ?? null,
    salida: r.salida ?? null,
    total: r.total ?? null,
    entrega: r.entrega ?? null,
    recibe: r.recibe ?? null,
    mat_integro: r.mat_integro ?? true,
    mat_buen_estado: r.mat_buen_estado ?? true,
    mat_limpio: r.mat_limpio ?? true,
    mat_libre_olores: r.mat_libre_olores ?? true,
    mat_libre_plagas: r.mat_libre_plagas ?? true,
    mat_otros: r.mat_otros ?? null,
    tr_integro: r.tr_integro ?? true,
    tr_buen_estado: r.tr_buen_estado ?? true,
    tr_limpio: r.tr_limpio ?? true,
    tr_libre_olores: r.tr_libre_olores ?? true,
    tr_libre_plagas: r.tr_libre_plagas ?? true,
    tr_otros: r.tr_otros ?? null,
    observaciones: r.observaciones ?? null,
  }
}

export async function generarMaterialEmpaquePDF(id: string, orgId: string): Promise<void> {
  const d = await cargarDatos(id, orgId)
  const blob = await pdf(<MaterialEmpaquePDF d={d} />).toBlob()
  descargar(blob, nombrePdf('Material_Empaque_Movimientos', d.fecha, d.instalacion))
}

export async function generarBlobMaterialEmpaque(id: string, orgId: string): Promise<Blob> {
  const d = await cargarDatos(id, orgId)
  return pdf(<MaterialEmpaquePDF d={d} />).toBlob()
}
