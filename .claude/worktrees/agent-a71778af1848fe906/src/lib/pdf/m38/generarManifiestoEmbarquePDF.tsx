import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { ManifiestoEmbarquePDF, type M38ManifiestoDataPDF, type M38LineaPDF } from './ManifiestoEmbarquePDF'
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

async function cargarDatos(id: string, orgId: string): Promise<M38ManifiestoDataPDF> {
  const [manRes, linRes, orgRes] = await Promise.all([
    (supabase as any).from('m38_manifiestos')
      .select('*, ranchos(nombre)')
      .eq('id', id)
      .eq('org_id', orgId)
      .single(),
    (supabase as any).from('m38_lineas')
      .select('*')
      .eq('manifiesto_id', id)
      .eq('org_id', orgId)
      .order('orden'),
    (supabase as any).from('organizaciones')
      .select('nombre')
      .eq('id', orgId)
      .single(),
  ])
  if (manRes.error) throw manRes.error
  if (linRes.error) throw linRes.error

  const m = manRes.data as any
  const lineas: M38LineaPDF[] = ((linRes.data ?? []) as any[]).map((l) => ({
    orden: l.orden,
    tarima: l.tarima ?? '',
    producto: l.producto ?? '',
    presentacion: l.presentacion ?? '',
    cajas: l.cajas ?? null,
    temp_superior: l.temp_superior ?? null,
    temp_medio: l.temp_medio ?? null,
    temp_inferior: l.temp_inferior ?? null,
  }))

  return {
    orgNombre: orgRes.data?.nombre ?? '—',
    instalacion: m.ranchos?.nombre ?? '—',
    fecha: m.fecha,
    folio: m.folio ?? null,
    empresa: m.empresa ?? null,
    linea_transportista: m.linea_transportista ?? null,
    nombre_chofer: m.nombre_chofer ?? null,
    placas_tractor: m.placas_tractor ?? null,
    caja_pies: m.caja_pies ?? null,
    econ_tractor: m.econ_tractor ?? null,
    econ_caja: m.econ_caja ?? null,
    num_sello: m.num_sello ?? null,
    num_chismografo: m.num_chismografo ?? null,
    llegada_hora: m.llegada_hora ?? null,
    llegada_temp: m.llegada_temp ?? null,
    carga_hora: m.carga_hora ?? null,
    carga_temp: m.carga_temp ?? null,
    salida_hora: m.salida_hora ?? null,
    salida_temp: m.salida_temp ?? null,
    cond_buen_estado: m.cond_buen_estado ?? true,
    cond_limpio: m.cond_limpio ?? true,
    cond_presencia_plagas: m.cond_presencia_plagas ?? false,
    tar_remontado: m.tar_remontado ?? 'bueno',
    tar_flejado: m.tar_flejado ?? 'bueno',
    tar_limpieza: m.tar_limpieza ?? 'bueno',
    tar_condicion: m.tar_condicion ?? 'bueno',
    tar_distribucion: m.tar_distribucion ?? 'bueno',
    lineas,
    observaciones: m.observaciones ?? null,
  }
}

export async function generarManifiestoEmbarquePDF(id: string, orgId: string, codigoClave: string): Promise<void> {
  const d = await cargarDatos(id, orgId)
  const blob = await pdf(<ManifiestoEmbarquePDF d={d} codigoClave={codigoClave} />).toBlob()
  descargar(blob, nombrePdf('Manifiesto_Embarque', d.fecha, d.instalacion))
}

export async function generarBlobManifiestoEmbarque(id: string, orgId: string, codigoClave: string): Promise<Blob> {
  const d = await cargarDatos(id, orgId)
  return pdf(<ManifiestoEmbarquePDF d={d} codigoClave={codigoClave} />).toBlob()
}
