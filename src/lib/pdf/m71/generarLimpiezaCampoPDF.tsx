import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  LimpiezaCampoPDF,
  LimpiezaCampoConsolidadoPDF,
  type M71ItemPDF,
  type LimpiezaCampoPaginaProps,
} from './LimpiezaCampoPDF'
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

async function construirPaginaM71(
  registroId: string,
  orgId: string,
  itemsCatalogo?: M71ItemPDF[],
): Promise<LimpiezaCampoPaginaProps> {
  const { data: reg, error: regErr } = await tbl('m71_registro')
    .select('*, ranchos(nombre)')
    .eq('id', registroId)
    .single()
  if (regErr) throw regErr

  let items: M71ItemPDF[]
  if (itemsCatalogo) {
    items = itemsCatalogo
  } else {
    const { data: cat, error: catErr } = await tbl('m71_items_catalogo')
      .select('id, seccion, numero, texto')
      .eq('activo', true)
      .order('numero')
    if (catErr) throw catErr
    items = (cat ?? []) as M71ItemPDF[]
  }

  const { data: resultados, error: resErr } = await tbl('m71_resultados')
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

  return {
    rancho: (reg as any).ranchos?.nombre ?? '—',
    mes: (reg as any).mes as string,
    mesLabel: formatMesLabel((reg as any).mes),
    realizoNombre: (reg as any).realizo ?? null,
    observaciones: (reg as any).observaciones ?? null,
    items,
    diasConResultados,
    matriz,
  }
}

export async function generarLimpiezaCampoPDF(
  id: string,
  orgId: string,
  _codigoClave?: string,
): Promise<void> {
  const datos = await construirPaginaM71(id, orgId)
  const firmasMapa = await obtenerFirmasParaPdf('M71', [id])
  const firmasReg = firmasMapa[id]
  const blob = await pdf(
    <LimpiezaCampoPDF
      {...datos}
      firmaRealizo={firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null}
      firmaVerifico={firmasReg?.verifico ? firmaDetalleAParaPdf(firmasReg.verifico) : null}
    />
  ).toBlob()
  descargar(blob, nombrePdf('LimpiezaCampo', datos.mes.slice(0, 7), datos.rancho))
}

export async function generarBlobLimpiezaCampo(
  id: string,
  orgId: string,
  _codigoClave?: string,
): Promise<Blob> {
  const datos = await construirPaginaM71(id, orgId)
  const firmasMapa = await obtenerFirmasParaPdf('M71', [id])
  const firmasReg = firmasMapa[id]
  return pdf(
    <LimpiezaCampoPDF
      {...datos}
      firmaRealizo={firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null}
      firmaVerifico={firmasReg?.verifico ? firmaDetalleAParaPdf(firmasReg.verifico) : null}
    />
  ).toBlob()
}

export async function generarLimpiezaCampoConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  _ranchoNombre: string,
  _orgNombre?: string | null,
  _codigoClave?: string,
): Promise<void> {
  let query = tbl('m71_registro')
    .select('id, mes')
    .eq('org_id', orgId)
    .gte('mes', desde)
    .lte('mes', hasta)
    .order('mes', { ascending: true })
  if (ranchoId) query = query.eq('rancho_id', ranchoId)
  const { data: registros, error } = await query
  if (error) throw error
  if (!registros?.length) throw new Error('Sin registros en el rango seleccionado')

  const { data: cat, error: catErr } = await tbl('m71_items_catalogo')
    .select('id, seccion, numero, texto')
    .eq('activo', true)
    .order('numero')
  if (catErr) throw catErr
  const items = (cat ?? []) as M71ItemPDF[]

  const paginas = await Promise.all(
    (registros as any[]).map(r => construirPaginaM71(r.id, orgId, items))
  )
  const firmasIds = (registros as any[]).map(r => r.id)
  const firmasMapa = await obtenerFirmasParaPdf('M71', firmasIds)

  const paginasConFirmas: LimpiezaCampoPaginaProps[] = paginas.map((p, i) => {
    const firmasReg = firmasMapa[firmasIds[i]]
    return {
      ...p,
      firmaRealizo: firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null,
      firmaVerifico: firmasReg?.verifico ? firmaDetalleAParaPdf(firmasReg.verifico) : null,
    }
  })

  const blob = await pdf(
    <LimpiezaCampoConsolidadoPDF paginas={paginasConFirmas} />
  ).toBlob()
  descargar(blob, nombrePdf('LimpiezaCampo_consolidado', `${desde}_${hasta}`))
}
