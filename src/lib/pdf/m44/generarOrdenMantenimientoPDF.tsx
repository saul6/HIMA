import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { OrdenMantenimientoPDF, type OrdenMantenimientoPDFProps } from './OrdenMantenimientoPDF'

async function cargarDatos(id: string, orgId: string): Promise<OrdenMantenimientoPDFProps & { folio: string | null; fecha: string }> {
  const tbl = supabase as any
  const [{ data: orden, error: oErr }, { data: org, error: orgErr }] = await Promise.all([
    tbl
      .from('m44_ordenes')
      .select(`
        id, fecha, folio, descripcion_solicitud, prioridad,
        solicita, recibe_mtto, equipo_produccion, lavado_sanitizado,
        observaciones, entrega_mtto, recibe,
        ranchos(nombre, codigo)
      `)
      .eq('id', id)
      .eq('org_id', orgId)
      .single(),
    tbl
      .from('organizaciones')
      .select('nombre')
      .eq('id', orgId)
      .single(),
  ])
  if (oErr)   throw oErr
  if (orgErr) throw orgErr

  const r = orden as any
  return {
    organizacion:          (org as any)?.nombre ?? '—',
    instalacion:           (r.ranchos as any)?.nombre ?? '—',
    instalacionCodigo:     (r.ranchos as any)?.codigo ?? '—',
    fecha:                 r.fecha,
    folio:                 r.folio ?? null,
    descripcion_solicitud: r.descripcion_solicitud ?? null,
    prioridad:             r.prioridad,
    solicita:              r.solicita ?? null,
    recibe_mtto:           r.recibe_mtto ?? null,
    equipo_produccion:     r.equipo_produccion ?? false,
    lavado_sanitizado:     r.lavado_sanitizado ?? false,
    observaciones:         r.observaciones ?? null,
    entrega_mtto:          r.entrega_mtto ?? null,
    recibe:                r.recibe ?? null,
  }
}

function slugFolio(folio: string | null): string {
  if (!folio) return ''
  return folio.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30)
}

export async function generarOrdenMantenimientoPDF(id: string, orgId: string): Promise<void> {
  const datos = await cargarDatos(id, orgId)
  const blob  = await pdf(<OrdenMantenimientoPDF {...datos} />).toBlob()
  const slug  = slugFolio(datos.folio)
  const url   = URL.createObjectURL(blob)
  const a     = document.createElement('a')
  a.href      = url
  a.download  = `Orden_Mantenimiento-${slug || datos.fecha}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export async function generarBlobOrdenMantenimiento(id: string, orgId: string): Promise<Blob> {
  const datos = await cargarDatos(id, orgId)
  return pdf(<OrdenMantenimientoPDF {...datos} />).toBlob()
}
