import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  NotaTrazabilidadPDF,
  NotaTrazabilidadConsolidadoPDF,
  type NotaTrazabilidadConsolidadaRow,
} from './NotaTrazabilidadPDF'
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

async function cargarRegistroM78(id: string, orgId: string) {
  const { data: reg, error } = await tbl('m78_nota_trazabilidad')
    .select('*, ranchos(nombre)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (error) throw error
  return reg as any
}

export async function generarNotaTrazabilidadPDF(
  id: string,
  orgId: string,
  codigoClave?: string,
): Promise<void> {
  const reg = await cargarRegistroM78(id, orgId)
  const firmasMapa = await obtenerFirmasParaPdf('M78', [id])
  const firmasReg = firmasMapa[id]
  const blob = await pdf(
    <NotaTrazabilidadPDF
      folio={reg.folio ?? null}
      fecha={reg.fecha}
      productor={reg.productor ?? null}
      hora_salida={reg.hora_salida ?? null}
      num_camion={reg.num_camion ?? null}
      zona={reg.zona ?? null}
      rancho={(reg.ranchos as any)?.nombre ?? '—'}
      sector={reg.sector ?? null}
      cultivo={reg.cultivo ?? null}
      presentacion={reg.presentacion ?? null}
      otro_presentacion={reg.otro_presentacion ?? null}
      peso_bruto={reg.peso_bruto ?? null}
      peso_neto={reg.peso_neto ?? null}
      total_producto={reg.total_producto ?? null}
      embarco={reg.embarco ?? null}
      chofer={reg.chofer ?? null}
      recibio={reg.recibio ?? null}
      observaciones={reg.observaciones ?? null}
      firmaRealizo={firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null}
      firmaVerifico={firmasReg?.verifico ? firmaDetalleAParaPdf(firmasReg.verifico) : null}
    />
  ).toBlob()
  descargar(blob, nombrePdf('NotaTrazabilidad', reg.fecha))
}

export async function generarBlobNotaTrazabilidad(
  id: string,
  orgId: string,
  _codigoClave?: string,
): Promise<Blob> {
  const reg = await cargarRegistroM78(id, orgId)
  const firmasMapa = await obtenerFirmasParaPdf('M78', [id])
  const firmasReg = firmasMapa[id]
  return pdf(
    <NotaTrazabilidadPDF
      folio={reg.folio ?? null}
      fecha={reg.fecha}
      productor={reg.productor ?? null}
      hora_salida={reg.hora_salida ?? null}
      num_camion={reg.num_camion ?? null}
      zona={reg.zona ?? null}
      rancho={(reg.ranchos as any)?.nombre ?? '—'}
      sector={reg.sector ?? null}
      cultivo={reg.cultivo ?? null}
      presentacion={reg.presentacion ?? null}
      otro_presentacion={reg.otro_presentacion ?? null}
      peso_bruto={reg.peso_bruto ?? null}
      peso_neto={reg.peso_neto ?? null}
      total_producto={reg.total_producto ?? null}
      embarco={reg.embarco ?? null}
      chofer={reg.chofer ?? null}
      recibio={reg.recibio ?? null}
      observaciones={reg.observaciones ?? null}
      firmaRealizo={firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null}
      firmaVerifico={firmasReg?.verifico ? firmaDetalleAParaPdf(firmasReg.verifico) : null}
    />
  ).toBlob()
}

export async function generarNotaTrazabilidadConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  ranchoNombre: string,
  orgNombre?: string | null,
  _codigoClave?: string,
): Promise<void> {
  let query = tbl('m78_nota_trazabilidad')
    .select('*, ranchos(nombre)')
    .eq('org_id', orgId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })
  if (ranchoId) query = query.eq('rancho_id', ranchoId)

  const { data: registros, error } = await query
  if (error) throw error
  if (!registros?.length) throw new Error('Sin registros en el rango seleccionado')

  const rows: NotaTrazabilidadConsolidadaRow[] = (registros as any[]).map((r: any) => ({
    folio: r.folio ?? null,
    fecha: r.fecha,
    rancho: (r.ranchos as any)?.nombre ?? ranchoNombre,
    sector: r.sector ?? null,
    cultivo: r.cultivo ?? null,
    presentacion: r.presentacion ?? null,
    peso_bruto: r.peso_bruto ?? null,
    peso_neto: r.peso_neto ?? null,
    total_producto: r.total_producto ?? null,
    chofer: r.chofer ?? null,
    recibio: r.recibio ?? null,
  }))

  const blob = await pdf(
    <NotaTrazabilidadConsolidadoPDF
      rows={rows}
      orgNombre={orgNombre}
      desde={desde}
      hasta={hasta}
    />
  ).toBlob()
  descargar(blob, nombrePdf('NotaTrazabilidad_consolidado', `${desde}_${hasta}`))
}
