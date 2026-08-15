import { pdf } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { hoyMX } from '@/lib/fecha'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { EtiquetaLPTPDF, LOGO_LOS_GEMELOS_PATH, type EtiquetaLPTData } from './EtiquetaLPTPDF'

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

function imprimirPdfBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  iframe.src = url
  document.body.appendChild(iframe)
  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    // Limpia después de 60 s para dar tiempo al diálogo de impresión
    setTimeout(() => { URL.revokeObjectURL(url); iframe.remove() }, 60_000)
  }
}

function ff(iso: string | null | undefined): string {
  if (!iso) return '—'
  try { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` } catch { return iso }
}

function buildQrText(d: Omit<EtiquetaLPTData, 'qrDataUrl' | 'logoUrl'>): string {
  return [
    `LPT: ${d.lptCodigo}`,
    `Producto: ${d.producto}`,
    `Presentacion: ${d.presentacion ?? 'Caja / segun cliente'}`,
    `Turno: T${d.turno}`,
    `Fecha empaque: ${ff(d.fechaEmpaque)}`,
    `${d.origenTipo ?? 'LR'}: ${d.origenCodigo ?? '—'}`,
    `Proveedor: ${d.proveedorCodigo ?? '—'}`,
    `Cliente/destino: ${d.clienteDestino}`,
    `Empresa: ${d.orgNombre}`,
  ].join('\n')
}

async function fetchEtiquetaData(lptId: string, orgId: string): Promise<Omit<EtiquetaLPTData, 'qrDataUrl' | 'logoUrl'>> {
  const [lptRes, orgRes] = await Promise.all([
    tbl('m48_lotes_producto')
      .select('*, ranchos(nombre), m48_lotes_recepcion(codigo, proveedor_codigo), m48_lotes_compuestos(codigo)')
      .eq('id', lptId).eq('org_id', orgId).single(),
    tbl('organizaciones').select('nombre').eq('id', orgId).single(),
  ])
  if (lptRes.error) throw lptRes.error
  const lpt = lptRes.data
  const orgNombre: string = orgRes.data?.nombre ?? '—'
  const ranchoNombre: string = lpt.ranchos?.nombre ?? '—'

  const origenCodigo: string | null =
    lpt.m48_lotes_recepcion?.codigo ?? lpt.m48_lotes_compuestos?.codigo ?? null
  const origenTipo: 'LR' | 'LC' | null = lpt.lr_id ? 'LR' : lpt.lc_id ? 'LC' : null
  const proveedorCodigo: string | null = lpt.m48_lotes_recepcion?.proveedor_codigo ?? null
  const producto: string = lpt.codigo.split('-')[1] ?? '—'

  const feRes = await tbl('m48_fe_lpt')
    .select('m48_folios_embarque(cliente)')
    .eq('lpt_id', lptId)
    .maybeSingle()
  const clienteDestino: string = feRes.data?.m48_folios_embarque?.cliente ?? 'Segun programacion'

  return {
    lptCodigo: lpt.codigo,
    producto,
    presentacion: lpt.presentacion ?? null,
    fechaEmpaque: lpt.fecha_empaque,
    turno: lpt.turno,
    origenCodigo,
    origenTipo,
    proveedorCodigo,
    clienteDestino,
    cantEmpacada: lpt.cant_empacada ?? null,
    orgNombre,
    ranchoNombre,
  }
}

// ── Etiqueta 4"x8" ──────────────────────────────────────────────────────────

export async function generarEtiquetaLPT(lptId: string, orgId: string): Promise<void> {
  const base = await fetchEtiquetaData(lptId, orgId)
  const logoUrl = window.location.origin + LOGO_LOS_GEMELOS_PATH
  const qrDataUrl = await QRCode.toDataURL(buildQrText(base), { width: 400, margin: 1, errorCorrectionLevel: 'M' })
  const d: EtiquetaLPTData = { ...base, qrDataUrl, logoUrl }
  const blob = await pdf(<EtiquetaLPTPDF d={d} />).toBlob()
  descargar(blob, `Etiqueta_${base.lptCodigo}.pdf`)
}

export async function generarBlobEtiquetaLPT(lptId: string, orgId: string): Promise<Blob> {
  const base = await fetchEtiquetaData(lptId, orgId)
  const logoUrl = window.location.origin + LOGO_LOS_GEMELOS_PATH
  const qrDataUrl = await QRCode.toDataURL(buildQrText(base), { width: 400, margin: 1, errorCorrectionLevel: 'M' })
  const d: EtiquetaLPTData = { ...base, qrDataUrl, logoUrl }
  return pdf(<EtiquetaLPTPDF d={d} />).toBlob()
}

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

export async function registrarEImprimirEtiqueta(
  lptId: string, orgId: string, ranchoId: string,
  verificadoPor: string, cantidadEtiquetas: number,
): Promise<void> {
  const fecha = hoyMX()
  await tbl('m48_etiquetas').insert({
    lpt_id: lptId, org_id: orgId, rancho_id: ranchoId,
    fecha, verificado_por: verificadoPor,
    cantidad_etiquetas: cantidadEtiquetas, impreso: true,
  })
  const blob = await generarBlobEtiquetaLPT(lptId, orgId)
  imprimirPdfBlob(blob)
}

export { hoyMX, nombrePdf }
