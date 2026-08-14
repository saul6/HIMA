import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { RecepcionFrutaPDF, type M39RecepcionDataPDF, type M39LineaPDF } from './RecepcionFrutaPDF'
import { RecepcionFrutaAlmacenPDF, type M39RecepcionAlmacenDataPDF, type M39LineaAlmacenPDF } from './RecepcionFrutaAlmacenPDF'
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

type CargarResult =
  | { esAlmacen: false; d: M39RecepcionDataPDF }
  | { esAlmacen: true; d: M39RecepcionAlmacenDataPDF }

async function cargarDatos(id: string, orgId: string): Promise<CargarResult> {
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
  const rawLineas: any[] = linRes.data ?? []
  const orgNombre: string = orgRes.data?.nombre ?? '—'
  const instalacion: string = r.ranchos?.nombre ?? '—'

  // hoja_no !== null → almacén variant (CF records never set hoja_no)
  const esAlmacen = r.hoja_no !== null && r.hoja_no !== undefined

  if (esAlmacen) {
    const lineas: M39LineaAlmacenPDF[] = rawLineas.map((l) => ({
      orden: l.orden,
      hora: l.hora ?? null,
      cultivo: l.cultivo ?? null,
      cajas: l.cajas ?? null,
      piezas: l.piezas ?? null,
      entrega: l.entrega ?? null,
      limp_be: l.limp_be ?? null,
      limp_l: l.limp_l ?? null,
      limp_lp: l.limp_lp ?? null,
      codigo_trazabilidad: l.codigo_trazabilidad ?? null,
    }))
    const d: M39RecepcionAlmacenDataPDF = {
      orgNombre,
      instalacion,
      fecha: r.fecha,
      hoja_no: r.hoja_no || null,
      empresa: r.empresa ?? null,
      observaciones: r.observaciones ?? null,
      lineas,
    }
    return { esAlmacen: true, d }
  }

  const lineas: M39LineaPDF[] = rawLineas.map((l) => ({
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
  const d: M39RecepcionDataPDF = {
    orgNombre,
    instalacion,
    fecha: r.fecha,
    empresa: r.empresa ?? null,
    observaciones: r.observaciones ?? null,
    lineas,
  }
  return { esAlmacen: false, d }
}

export async function generarRecepcionFrutaPDF(id: string, orgId: string, codigoClave: string): Promise<void> {
  const result = await cargarDatos(id, orgId)
  let blob: Blob
  if (result.esAlmacen) {
    blob = await pdf(<RecepcionFrutaAlmacenPDF d={result.d} codigoClave={codigoClave} />).toBlob()
  } else {
    blob = await pdf(<RecepcionFrutaPDF d={result.d} codigoClave={codigoClave} />).toBlob()
  }
  descargar(blob, nombrePdf('Recepcion_Fruta', result.d.fecha))
}

export async function generarBlobRecepcionFruta(id: string, orgId: string, codigoClave: string): Promise<Blob> {
  const result = await cargarDatos(id, orgId)
  if (result.esAlmacen) {
    return pdf(<RecepcionFrutaAlmacenPDF d={result.d} codigoClave={codigoClave} />).toBlob()
  }
  return pdf(<RecepcionFrutaPDF d={result.d} codigoClave={codigoClave} />).toBlob()
}
