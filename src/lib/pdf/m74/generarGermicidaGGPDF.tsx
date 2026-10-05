import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  GermicidaGGPDF,
  GermicidaGGConsolidadoPDF,
  type GermicidaGGFilaPDF,
} from './GermicidaGGPDF'
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

async function construirFila(id: string, orgId: string): Promise<GermicidaGGFilaPDF> {
  const { data, error } = await tbl('m74_germicida')
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
    producto: r.producto ?? null,
    material_utilizado: r.material_utilizado ?? null,
    sector: r.sector ?? null,
    hora1: r.hora1 ?? null,
    ppm1: r.ppm1 ?? null,
    ajuste1: r.ajuste1 ?? null,
    hora2: r.hora2 ?? null,
    ppm2: r.ppm2 ?? null,
    ajuste2: r.ajuste2 ?? null,
    hora3: r.hora3 ?? null,
    ppm3: r.ppm3 ?? null,
    ajuste3: r.ajuste3 ?? null,
    realizo: r.realizo ?? null,
    observaciones: r.observaciones ?? null,
  }
}

export async function generarGermicidaGGPDF(
  id: string,
  orgId: string,
  _codigoClave?: string,
): Promise<void> {
  const fila = await construirFila(id, orgId)
  const firmasMapa = await obtenerFirmasParaPdf('M74', [id])
  const firmasReg = firmasMapa[id]
  const blob = await pdf(
    <GermicidaGGPDF
      rancho={fila.rancho}
      filas={[fila]}
      firmaRealizo={firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null}
      firmaVerifico={firmasReg?.verifico ? firmaDetalleAParaPdf(firmasReg.verifico) : null}
    />
  ).toBlob()
  descargar(blob, nombrePdf('GermicidaGG', fila.fecha))
}

export async function generarBlobGermicidaGG(
  id: string,
  orgId: string,
  _codigoClave?: string,
): Promise<Blob> {
  const fila = await construirFila(id, orgId)
  const firmasMapa = await obtenerFirmasParaPdf('M74', [id])
  const firmasReg = firmasMapa[id]
  return pdf(
    <GermicidaGGPDF
      rancho={fila.rancho}
      filas={[fila]}
      firmaRealizo={firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null}
      firmaVerifico={firmasReg?.verifico ? firmaDetalleAParaPdf(firmasReg.verifico) : null}
    />
  ).toBlob()
}

export async function generarGermicidaGGConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  _ranchoNombre: string,
  _orgNombre?: string | null,
  _codigoClave?: string,
): Promise<void> {
  let query = tbl('m74_germicida')
    .select('*, ranchos(nombre)')
    .eq('org_id', orgId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
  if (ranchoId) query = query.eq('rancho_id', ranchoId)
  const { data, error } = await query
  if (error) throw error
  if (!data?.length) throw new Error('Sin registros en el rango seleccionado')

  const filas: GermicidaGGFilaPDF[] = (data as any[]).map(r => ({
    id: r.id,
    rancho: r.ranchos?.nombre ?? '—',
    fecha: r.fecha as string,
    producto: r.producto ?? null,
    material_utilizado: r.material_utilizado ?? null,
    sector: r.sector ?? null,
    hora1: r.hora1 ?? null,
    ppm1: r.ppm1 ?? null,
    ajuste1: r.ajuste1 ?? null,
    hora2: r.hora2 ?? null,
    ppm2: r.ppm2 ?? null,
    ajuste2: r.ajuste2 ?? null,
    hora3: r.hora3 ?? null,
    ppm3: r.ppm3 ?? null,
    ajuste3: r.ajuste3 ?? null,
    realizo: r.realizo ?? null,
    observaciones: r.observaciones ?? null,
  }))

  const blob = await pdf(
    <GermicidaGGConsolidadoPDF filas={filas} orgNombre={_orgNombre} />
  ).toBlob()
  descargar(blob, nombrePdf('GermicidaGG_consolidado', `${desde}_${hasta}`))
}
