import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  VerificacionRoedoresPDF,
  VerificacionRoedoresConsolidadoPDF,
  type VerificacionRoedorFilaPDF,
} from './VerificacionRoedoresPDF'
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

async function construirFilas(
  orgId: string,
  ranchoId: string,
  fecha: string,
): Promise<{ rancho: string; filas: VerificacionRoedorFilaPDF[]; ids: string[] }> {
  const { data, error } = await tbl('m70_verificacion_roedores')
    .select('*, ranchos(nombre)')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .eq('fecha', fecha)
    .order('num_trampa', { ascending: true })
  if (error) throw error
  if (!data?.length) throw new Error('Sin registros')
  const rows = data as any[]
  const rancho = rows[0].ranchos?.nombre ?? '—'
  const filas: VerificacionRoedorFilaPDF[] = rows.map(r => ({
    id: r.id,
    fecha: r.fecha as string,
    num_trampa: r.num_trampa ?? '',
    roedor: !!r.roedor,
    insectos: !!r.insectos,
    otros: !!r.otros,
    cambio: !!r.cambio,
    verifico: r.verifico ?? null,
    observaciones: r.observaciones ?? null,
  }))
  return { rancho, filas, ids: rows.map(r => r.id as string) }
}

export async function generarVerificacionRoedoresPDF(
  orgId: string,
  ranchoId: string,
  fecha: string,
  _codigoClave?: string,
): Promise<void> {
  const { rancho, filas, ids } = await construirFilas(orgId, ranchoId, fecha)
  const firmasMapa = await obtenerFirmasParaPdf('M70', ids)
  const firmasReg = firmasMapa[ids[0]]
  const blob = await pdf(
    <VerificacionRoedoresPDF
      rancho={rancho}
      filas={filas}
      firmaRealizo={firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null}
      firmaVerifico={firmasReg?.verifico ? firmaDetalleAParaPdf(firmasReg.verifico) : null}
    />
  ).toBlob()
  descargar(blob, nombrePdf('VerificacionRoedoresGG', fecha))
}

export async function generarBlobVerificacionRoedores(
  orgId: string,
  ranchoId: string,
  fecha: string,
  _codigoClave?: string,
): Promise<Blob> {
  const { rancho, filas, ids } = await construirFilas(orgId, ranchoId, fecha)
  const firmasMapa = await obtenerFirmasParaPdf('M70', ids)
  const firmasReg = firmasMapa[ids[0]]
  return pdf(
    <VerificacionRoedoresPDF
      rancho={rancho}
      filas={filas}
      firmaRealizo={firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null}
      firmaVerifico={firmasReg?.verifico ? firmaDetalleAParaPdf(firmasReg.verifico) : null}
    />
  ).toBlob()
}

export async function generarVerificacionRoedoresConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  _ranchoNombre: string,
  _orgNombre?: string | null,
  _codigoClave?: string,
): Promise<void> {
  let query = tbl('m70_verificacion_roedores')
    .select('*, ranchos(nombre)')
    .eq('org_id', orgId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('num_trampa', { ascending: true })
  if (ranchoId) query = query.eq('rancho_id', ranchoId)
  const { data, error } = await query
  if (error) throw error
  if (!data?.length) throw new Error('Sin registros en el rango seleccionado')

  const filas = (data as any[]).map(r => ({
    id: r.id,
    rancho: r.ranchos?.nombre ?? '—',
    fecha: r.fecha as string,
    num_trampa: r.num_trampa ?? '',
    roedor: !!r.roedor,
    insectos: !!r.insectos,
    otros: !!r.otros,
    cambio: !!r.cambio,
    verifico: r.verifico ?? null,
    observaciones: r.observaciones ?? null,
  }))

  const blob = await pdf(
    <VerificacionRoedoresConsolidadoPDF
      rancho={_ranchoNombre || 'Todos'}
      filas={filas}
      orgNombre={_orgNombre}
    />
  ).toBlob()
  descargar(blob, nombrePdf('VerificacionRoedoresGG_consolidado', `${desde}_${hasta}`))
}
