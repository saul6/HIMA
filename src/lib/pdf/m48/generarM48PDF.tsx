import { pdf } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { hoyMX } from '@/lib/fecha'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { EtiquetaLPTPDF, type EtiquetaLPTData } from './EtiquetaLPTPDF'

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

// ── Etiqueta 4"x8" ──────────────────────────────────────────────────────────

export async function generarEtiquetaLPT(lptId: string, orgId: string): Promise<void> {
  const [lptRes, orgRes] = await Promise.all([
    tbl('m48_lotes_producto')
      .select('*, ranchos(nombre), m48_lotes_recepcion(codigo), m48_lotes_compuestos(codigo)')
      .eq('id', lptId).eq('org_id', orgId).single(),
    tbl('organizaciones').select('nombre').eq('id', orgId).single(),
  ])
  if (lptRes.error) throw lptRes.error
  const lpt = lptRes.data
  const orgNombre: string = orgRes.data?.nombre ?? '—'
  const ranchoNombre: string = lpt.ranchos?.nombre ?? '—'

  const origenCodigo: string | null = lpt.m48_lotes_recepcion?.codigo ?? lpt.m48_lotes_compuestos?.codigo ?? null
  const origenTipo: 'LR' | 'LC' | null = lpt.lr_id ? 'LR' : lpt.lc_id ? 'LC' : null

  const qrDataUrl = await QRCode.toDataURL(lpt.codigo, { width: 320, margin: 1, errorCorrectionLevel: 'M' })

  const d: EtiquetaLPTData = {
    lptCodigo: lpt.codigo,
    presentacion: lpt.presentacion ?? null,
    fechaEmpaque: lpt.fecha_empaque,
    turno: lpt.turno,
    origenCodigo,
    origenTipo,
    cantEmpacada: lpt.cant_empacada ?? null,
    unidad: null,
    orgNombre,
    ranchoNombre,
    qrDataUrl,
  }

  const blob = await pdf(<EtiquetaLPTPDF d={d} />).toBlob()
  descargar(blob, `Etiqueta_${lpt.codigo}.pdf`)
}

export async function generarBlobEtiquetaLPT(lptId: string, orgId: string): Promise<Blob> {
  const [lptRes, orgRes] = await Promise.all([
    tbl('m48_lotes_producto')
      .select('*, ranchos(nombre), m48_lotes_recepcion(codigo), m48_lotes_compuestos(codigo)')
      .eq('id', lptId).eq('org_id', orgId).single(),
    tbl('organizaciones').select('nombre').eq('id', orgId).single(),
  ])
  if (lptRes.error) throw lptRes.error
  const lpt = lptRes.data
  const orgNombre: string = orgRes.data?.nombre ?? '—'
  const ranchoNombre: string = lpt.ranchos?.nombre ?? '—'
  const origenCodigo: string | null = lpt.m48_lotes_recepcion?.codigo ?? lpt.m48_lotes_compuestos?.codigo ?? null
  const origenTipo: 'LR' | 'LC' | null = lpt.lr_id ? 'LR' : lpt.lc_id ? 'LC' : null
  const qrDataUrl = await QRCode.toDataURL(lpt.codigo, { width: 320, margin: 1, errorCorrectionLevel: 'M' })
  const d: EtiquetaLPTData = {
    lptCodigo: lpt.codigo, presentacion: lpt.presentacion ?? null,
    fechaEmpaque: lpt.fecha_empaque, turno: lpt.turno,
    origenCodigo, origenTipo, cantEmpacada: lpt.cant_empacada ?? null,
    unidad: null, orgNombre, ranchoNombre, qrDataUrl,
  }
  return pdf(<EtiquetaLPTPDF d={d} />).toBlob()
}

// Exportado para uso externo (registrar liberación en m48_etiquetas antes de imprimir)
export async function registrarYGenerarEtiqueta(
  lptId: string, orgId: string, ranchoId: string,
  verificadoPor: string, cantidadEtiquetas: number,
): Promise<void> {
  const fecha = hoyMX()
  await tbl('m48_etiquetas').insert({
    lpt_id: lptId, org_id: orgId, rancho_id: ranchoId,
    fecha, verificado_por: verificadoPor,
    cantidad_etiquetas: cantidadEtiquetas, impreso: true,
  })
  await generarEtiquetaLPT(lptId, orgId)
}

export { hoyMX, nombrePdf }
