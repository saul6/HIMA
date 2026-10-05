import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  InspeccionAlmacenEmpaqueGGPDF,
  InspeccionAlmacenEmpaqueGGConsolidadoPDF,
  type M75ItemPDF,
  type M75AccionPDF,
  type InspeccionAlmacenEmpaqueGGPaginaProps,
} from './InspeccionAlmacenEmpaqueGGPDF'
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

function formatMesLabel(isoDate: string): string {
  try {
    const s = new Date(isoDate + 'T12:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  } catch { return isoDate }
}

async function construirPaginaM75(
  registroId: string,
  orgId: string,
  itemsCatalogo?: M75ItemPDF[],
): Promise<InspeccionAlmacenEmpaqueGGPaginaProps> {
  const { data: reg, error: regErr } = await tbl('m75_registro')
    .select('*, ranchos(nombre)')
    .eq('id', registroId)
    .single()
  if (regErr) throw regErr

  let items: M75ItemPDF[]
  if (itemsCatalogo) {
    items = itemsCatalogo
  } else {
    const { data: cat, error: catErr } = await tbl('m75_items_catalogo')
      .select('id, numero, texto')
      .eq('activo', true)
      .order('numero')
    if (catErr) throw catErr
    items = (cat ?? []) as M75ItemPDF[]
  }

  const { data: resultados, error: resErr } = await tbl('m75_resultados')
    .select('item_id, dia, valor')
    .eq('registro_id', registroId)
    .eq('org_id', orgId)
  if (resErr) throw resErr

  const diasConResultados = new Set<number>()
  const matriz: Record<number, Record<string, string>> = {}
  for (const r of (resultados ?? []) as any[]) {
    diasConResultados.add(r.dia)
    if (!matriz[r.dia]) matriz[r.dia] = {}
    matriz[r.dia][r.item_id] = r.valor
  }

  const { data: accionesData, error: accErr } = await tbl('m75_acciones')
    .select('dia, texto')
    .eq('registro_id', registroId)
    .eq('org_id', orgId)
    .order('dia')
  if (accErr) throw accErr
  const acciones: M75AccionPDF[] = (accionesData ?? []) as M75AccionPDF[]

  return {
    rancho: (reg as any).ranchos?.nombre ?? '—',
    mes: (reg as any).mes as string,
    mesLabel: formatMesLabel((reg as any).mes),
    cultivo: (reg as any).cultivo ?? null,
    realizoNombre: (reg as any).realizo ?? null,
    observaciones: (reg as any).observaciones ?? null,
    items,
    diasConResultados,
    matriz,
    acciones,
  }
}

export async function generarInspeccionAlmacenEmpaqueGGPDF(
  id: string,
  orgId: string,
  _codigoClave?: string,
): Promise<void> {
  const datos = await construirPaginaM75(id, orgId)
  const firmasMapa = await obtenerFirmasParaPdf('M75', [id])
  const firmasReg = firmasMapa[id]
  const blob = await pdf(
    <InspeccionAlmacenEmpaqueGGPDF
      {...datos}
      firmaRealizo={firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null}
      firmaVerifico={firmasReg?.verifico ? firmaDetalleAParaPdf(firmasReg.verifico) : null}
    />
  ).toBlob()
  descargar(blob, nombrePdf('InspeccionAlmacenEmpaqueGG', datos.mes.slice(0, 7), datos.rancho))
}

export async function generarBlobInspeccionAlmacenEmpaqueGG(
  id: string,
  orgId: string,
  _codigoClave?: string,
): Promise<Blob> {
  const datos = await construirPaginaM75(id, orgId)
  const firmasMapa = await obtenerFirmasParaPdf('M75', [id])
  const firmasReg = firmasMapa[id]
  return pdf(
    <InspeccionAlmacenEmpaqueGGPDF
      {...datos}
      firmaRealizo={firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null}
      firmaVerifico={firmasReg?.verifico ? firmaDetalleAParaPdf(firmasReg.verifico) : null}
    />
  ).toBlob()
}

export async function generarInspeccionAlmacenEmpaqueGGConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  _ranchoNombre: string,
  _orgNombre?: string | null,
  _codigoClave?: string,
): Promise<void> {
  let query = tbl('m75_registro')
    .select('id, mes')
    .eq('org_id', orgId)
    .gte('mes', desde)
    .lte('mes', hasta)
    .order('mes', { ascending: true })
  if (ranchoId) query = query.eq('rancho_id', ranchoId)
  const { data: registros, error } = await query
  if (error) throw error
  if (!registros?.length) throw new Error('Sin registros en el rango seleccionado')

  const { data: cat, error: catErr } = await tbl('m75_items_catalogo')
    .select('id, numero, texto')
    .eq('activo', true)
    .order('numero')
  if (catErr) throw catErr
  const items = (cat ?? []) as M75ItemPDF[]

  const paginas = await Promise.all(
    (registros as any[]).map(r => construirPaginaM75(r.id, orgId, items))
  )
  const firmasIds = (registros as any[]).map(r => r.id)
  const firmasMapa = await obtenerFirmasParaPdf('M75', firmasIds)

  const paginasConFirmas: InspeccionAlmacenEmpaqueGGPaginaProps[] = paginas.map((p, i) => {
    const firmasReg = firmasMapa[firmasIds[i]]
    return {
      ...p,
      firmaRealizo: firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null,
      firmaVerifico: firmasReg?.verifico ? firmaDetalleAParaPdf(firmasReg.verifico) : null,
    }
  })

  const blob = await pdf(
    <InspeccionAlmacenEmpaqueGGConsolidadoPDF paginas={paginasConFirmas} />
  ).toBlob()
  descargar(blob, nombrePdf('InspeccionAlmacenEmpaqueGG_consolidado', `${desde}_${hasta}`))
}
