import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { AccionesCorrectivasPDF, type AccionPDFFila } from './AccionesCorrectivasPDF'
import { fotosAccionADataUris } from '@/lib/storage/accionesCorrectivasStorage'
import { nombrePdf } from '@/lib/pdf/nombrePdf'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

interface DatosAccionPDF {
  orgNombre: string
  ranchoNombre: string
  fechaTitulo: string
  acciones: AccionPDFFila[]
}

function parseComentario(raw: string | null): { realizo: string | null; verifico: string | null } {
  if (!raw) return { realizo: null, verifico: null }
  const rm = raw.match(/Realiz[oó]:\s*([^·]+)/)
  const vm = raw.match(/Verific[oó]:\s*(.+)/)
  return { realizo: rm?.[1]?.trim() || null, verifico: vm?.[1]?.trim() || null }
}

async function lookupRanchoFromRespuesta(
  modulo: string,
  sourceRecordId: string,
  orgId: string,
): Promise<string> {
  try {
    const { data } = await tbl(`${modulo}_respuestas`)
      .select(`${modulo}_auditorias!auditoria_id(ranchos!rancho_id(nombre))`)
      .eq('id', sourceRecordId)
      .eq('org_id', orgId)
      .single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any)?.[`${modulo}_auditorias`]?.ranchos?.nombre ?? '—'
  } catch {
    return '—'
  }
}

async function capaToFila(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fotosMap: Map<string, any[]>,
  uris: Record<string, string>,
): Promise<AccionPDFFila> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const h = (c.aud_hallazgos as any) ?? {}
  const { realizo, verifico } = parseComentario(c.comentario_accion)
  const fotos = fotosMap.get(c.id) ?? []
  return {
    codigo_pregunta: h.criterion_code ?? '—',
    modulo_label: (h.source_module_code ?? '').toUpperCase(),
    no_conformidad: h.descripcion ?? null,
    causa: c.causa_raiz ?? null,
    accion_correctiva: c.correccion_inmediata ?? null,
    accion_preventiva: c.accion_preventiva ?? null,
    fecha_deteccion: h.detectado_en ?? null,
    fecha_cumplimiento: c.due_at ?? null,
    realizo,
    verifico,
    ishikawa: null,
    fotos: fotos.map((f: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      tipo: f.tipo as 'no_conformidad' | 'evidencia_correccion',
      leyenda: f.leyenda ?? null,
      dataUri: uris[f.storage_path] ?? '',
    })),
  }
}

async function cargarDatosAccion(
  capaId: string,
  orgId: string,
  ranchoNombreHint?: string,
): Promise<DatosAccionPDF> {
  const [capaResult, orgResult, fotosResult] = await Promise.all([
    tbl('aud_acciones_correctivas')
      .select('*, aud_hallazgos!hallazgo_id(descripcion, criterion_code, source_module_code, source_record_id, detectado_en)')
      .eq('id', capaId)
      .eq('org_id', orgId)
      .single(),
    tbl('organizaciones').select('nombre').eq('id', orgId).single(),
    tbl('accion_correctiva_fotos')
      .select('id, tipo, storage_path, leyenda')
      .eq('capa_id', capaId)
      .eq('org_id', orgId),
  ])
  if (capaResult.error) throw capaResult.error

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = capaResult.data as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const h = (c.aud_hallazgos as any) ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgNombre: string = (orgResult.data as any)?.nombre ?? '—'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fotasList = (fotosResult.data ?? []) as any[]
  const fotosMap = new Map([[capaId, fotasList]])
  const allPaths = fotasList.map((f: any) => f.storage_path as string) // eslint-disable-line @typescript-eslint/no-explicit-any
  const uris = await fotosAccionADataUris(allPaths)

  let ranchoNombre = ranchoNombreHint ?? '—'
  if (ranchoNombre === '—' && h.source_module_code && h.source_record_id) {
    ranchoNombre = await lookupRanchoFromRespuesta(h.source_module_code, h.source_record_id, orgId)
  }

  const fechaTitulo: string = h.detectado_en ?? c.created_at?.split('T')[0] ?? '—'
  const accion = await capaToFila(c, fotosMap, uris)

  return { orgNombre, ranchoNombre, fechaTitulo, acciones: [accion] }
}

async function cargarDatosMultiples(
  capaIds: string[],
  orgId: string,
  orgNombre: string,
  ranchoNombre: string,
  fechaTitulo: string,
): Promise<DatosAccionPDF> {
  const [capasResult, fotosResult] = await Promise.all([
    tbl('aud_acciones_correctivas')
      .select('*, aud_hallazgos!hallazgo_id(descripcion, criterion_code, source_module_code, source_record_id, detectado_en)')
      .in('id', capaIds)
      .eq('org_id', orgId)
      .order('created_at', { ascending: true }),
    tbl('accion_correctiva_fotos')
      .select('id, tipo, storage_path, leyenda, capa_id')
      .in('capa_id', capaIds)
      .eq('org_id', orgId),
  ])
  if (capasResult.error) throw capasResult.error

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (capasResult.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fotosMap = new Map<string, any[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const f of (fotosResult.data ?? []) as any[]) {
    const cId = f.capa_id as string
    if (!fotosMap.has(cId)) fotosMap.set(cId, [])
    fotosMap.get(cId)!.push(f)
  }
  const allPaths = (fotosResult.data ?? []).map((f: any) => f.storage_path as string) // eslint-disable-line @typescript-eslint/no-explicit-any
  const uris = await fotosAccionADataUris(allPaths)

  const acciones = await Promise.all(rows.map((c) => capaToFila(c, fotosMap, uris)))

  return { orgNombre, ranchoNombre, fechaTitulo, acciones }
}

export async function generarAccionCorrectivaIndividualPDF(
  capaId: string,
  orgId: string,
  fecha: string,
  ranchoNombre?: string,
): Promise<void> {
  const datos = await cargarDatosAccion(capaId, orgId, ranchoNombre)
  const blob = await pdf(<AccionesCorrectivasPDF {...datos} />).toBlob()
  descargarBlob(blob, nombrePdf('Acciones_Correctivas', fecha, datos.ranchoNombre))
}

export async function generarAccionesCorrectivasPDF(
  capaIds: string[],
  orgId: string,
  orgNombre: string,
  ranchoNombre: string,
  fechaTitulo: string,
): Promise<void> {
  const datos = await cargarDatosMultiples(capaIds, orgId, orgNombre, ranchoNombre, fechaTitulo)
  const blob = await pdf(<AccionesCorrectivasPDF {...datos} />).toBlob()
  descargarBlob(blob, nombrePdf('Acciones_Correctivas', fechaTitulo, ranchoNombre))
}

export async function generarBlobAccionCorrectiva(capaId: string, orgId: string): Promise<Blob> {
  const datos = await cargarDatosAccion(capaId, orgId)
  return pdf(<AccionesCorrectivasPDF {...datos} />).toBlob()
}
