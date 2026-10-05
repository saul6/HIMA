import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  InventarioBotiquinGGPDF,
  InventarioBotiquinGGConsolidadoPDF,
  type M73MaterialFilaPDF,
  type M73ResumenFilaPDF,
} from './InventarioBotiquinGGPDF'
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

interface RegistroDatos {
  id: string
  rancho: string
  fecha: string
  botiquin_num: string | null
  realizo: string | null
  observaciones: string | null
  materiales: M73MaterialFilaPDF[]
}

async function construirDatos(id: string, orgId: string): Promise<RegistroDatos> {
  const { data: reg, error: e1 } = await tbl('m73_registro')
    .select('*, ranchos(nombre)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (e1) throw e1

  const { data: resultados, error: e2 } = await tbl('m73_resultados')
    .select('*, m73_items_catalogo(nombre)')
    .eq('registro_id', id)
    .order('created_at', { ascending: true })
  if (e2) throw e2

  const r = reg as any
  const materiales: M73MaterialFilaPDF[] = (resultados as any[]).map((row) => ({
    nombre: row.m73_items_catalogo?.nombre ?? row.material_otro ?? '—',
    sale: row.sale ?? null,
    entra: row.entra ?? null,
    total: row.total ?? null,
    usuario: row.usuario ?? null,
  }))

  return {
    id,
    rancho: r.ranchos?.nombre ?? '—',
    fecha: r.fecha as string,
    botiquin_num: r.botiquin_num ?? null,
    realizo: r.realizo ?? null,
    observaciones: r.observaciones ?? null,
    materiales,
  }
}

export async function generarInventarioBotiquinGGPDF(
  id: string,
  orgId: string,
  _codigoClave?: string,
): Promise<void> {
  const datos = await construirDatos(id, orgId)
  const firmasMapa = await obtenerFirmasParaPdf('M73', [id])
  const firmasReg = firmasMapa[id]
  const blob = await pdf(
    <InventarioBotiquinGGPDF
      rancho={datos.rancho}
      fecha={datos.fecha}
      botiquin_num={datos.botiquin_num}
      realizo={datos.realizo}
      observaciones={datos.observaciones}
      materiales={datos.materiales}
      firmaRealizo={firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null}
    />
  ).toBlob()
  descargar(blob, nombrePdf('InventarioBotiquinGG', datos.fecha))
}

export async function generarBlobInventarioBotiquinGG(
  id: string,
  orgId: string,
  _codigoClave?: string,
): Promise<Blob> {
  const datos = await construirDatos(id, orgId)
  const firmasMapa = await obtenerFirmasParaPdf('M73', [id])
  const firmasReg = firmasMapa[id]
  return pdf(
    <InventarioBotiquinGGPDF
      rancho={datos.rancho}
      fecha={datos.fecha}
      botiquin_num={datos.botiquin_num}
      realizo={datos.realizo}
      observaciones={datos.observaciones}
      materiales={datos.materiales}
      firmaRealizo={firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null}
    />
  ).toBlob()
}

export async function generarInventarioBotiquinGGConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  _ranchoNombre: string,
  _orgNombre?: string | null,
  _codigoClave?: string,
): Promise<void> {
  let query = tbl('m73_registro')
    .select('id, fecha, rancho_id, botiquin_num, realizo, observaciones, total_materiales, ranchos(nombre)')
    .eq('org_id', orgId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
  if (ranchoId) query = query.eq('rancho_id', ranchoId)
  const { data, error } = await query
  if (error) throw error
  if (!data?.length) throw new Error('Sin registros en el rango seleccionado')

  const filas: M73ResumenFilaPDF[] = (data as any[]).map((r) => ({
    id: r.id,
    rancho: r.ranchos?.nombre ?? '—',
    fecha: r.fecha,
    botiquin_num: r.botiquin_num ?? null,
    realizo: r.realizo ?? null,
    total_materiales: r.total_materiales ?? 0,
    observaciones: r.observaciones ?? null,
  }))

  const blob = await pdf(
    <InventarioBotiquinGGConsolidadoPDF filas={filas} orgNombre={_orgNombre} />
  ).toBlob()
  descargar(blob, nombrePdf('InventarioBotiquinGG-consolidado', `${desde}_${hasta}`))
}
