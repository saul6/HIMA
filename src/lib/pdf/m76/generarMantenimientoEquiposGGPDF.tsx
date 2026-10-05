import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  MantenimientoEquiposGGPDF,
  MantenimientoEquiposGGConsolidadoPDF,
  type MantenimientoEquiposGGFilaPDF,
} from './MantenimientoEquiposGGPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { obtenerFirmasParaPdf, firmaDetalleAParaPdf } from '@/hooks/useFirmasRegistro'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

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

async function construirFila(id: string, orgId: string): Promise<MantenimientoEquiposGGFilaPDF> {
  const { data, error } = await tbl('m76_mantenimiento_equipos')
    .select('*, ranchos(nombre)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (error) throw error
  const r = data as any
  return {
    id: r.id,
    rancho: r.ranchos?.nombre ?? '—',
    fecha: r.fecha as string,
    equipo: r.equipo ?? null,
    realizo: r.realizo ?? null,
    tipo_actividad: r.tipo_actividad ?? null,
    fugas_tanque_bomba: r.fugas_tanque_bomba ?? null,
    mangueras: r.mangueras ?? null,
    pistola: r.pistola ?? null,
    lanzas: r.lanzas ?? null,
    boquillas: r.boquillas ?? null,
    descripcion_trabajo: r.descripcion_trabajo ?? null,
    observaciones: r.observaciones ?? null,
  }
}

export async function generarMantenimientoEquiposGGPDF(
  id: string,
  orgId: string,
  _codigoClave?: string,
): Promise<void> {
  const fila = await construirFila(id, orgId)
  const firmasMapa = await obtenerFirmasParaPdf('M76', [id])
  const firmasReg = firmasMapa[id]
  const blob = await pdf(
    <MantenimientoEquiposGGPDF
      fila={fila}
      firmaRealizo={firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null}
    />
  ).toBlob()
  descargar(blob, nombrePdf('MantenimientoEquiposGG', fila.fecha))
}

export async function generarBlobMantenimientoEquiposGG(
  id: string,
  orgId: string,
  _codigoClave?: string,
): Promise<Blob> {
  const fila = await construirFila(id, orgId)
  const firmasMapa = await obtenerFirmasParaPdf('M76', [id])
  const firmasReg = firmasMapa[id]
  return pdf(
    <MantenimientoEquiposGGPDF
      fila={fila}
      firmaRealizo={firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null}
    />
  ).toBlob()
}

export async function generarMantenimientoEquiposGGConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  _ranchoNombre: string,
  _orgNombre?: string | null,
  _codigoClave?: string,
): Promise<void> {
  let query = tbl('m76_mantenimiento_equipos')
    .select('*, ranchos(nombre)')
    .eq('org_id', orgId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
  if (ranchoId) query = query.eq('rancho_id', ranchoId)
  const { data, error } = await query
  if (error) throw error
  if (!data?.length) throw new Error('Sin registros en el rango seleccionado')

  const filas: MantenimientoEquiposGGFilaPDF[] = (data as any[]).map((r) => ({
    id: r.id,
    rancho: r.ranchos?.nombre ?? '—',
    fecha: r.fecha as string,
    equipo: r.equipo ?? null,
    realizo: r.realizo ?? null,
    tipo_actividad: r.tipo_actividad ?? null,
    fugas_tanque_bomba: r.fugas_tanque_bomba ?? null,
    mangueras: r.mangueras ?? null,
    pistola: r.pistola ?? null,
    lanzas: r.lanzas ?? null,
    boquillas: r.boquillas ?? null,
    descripcion_trabajo: r.descripcion_trabajo ?? null,
    observaciones: r.observaciones ?? null,
  }))

  const blob = await pdf(
    <MantenimientoEquiposGGConsolidadoPDF filas={filas} orgNombre={_orgNombre} />
  ).toBlob()
  descargar(blob, nombrePdf('MantenimientoEquiposGG-consolidado', `${desde}_${hasta}`))
}
