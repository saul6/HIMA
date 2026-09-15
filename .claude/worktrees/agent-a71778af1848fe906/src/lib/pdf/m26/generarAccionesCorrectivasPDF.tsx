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

async function cargarDatosAccion(accionId: string, orgId: string): Promise<DatosAccionPDF> {
  const { data, error } = await tbl('acciones_correctivas')
    .select('*, accion_correctiva_fotos(id, tipo, storage_path, leyenda), auditoria_visitas!visita_id(rancho_id, ranchos!rancho_id(nombre))')
    .eq('id', accionId)
    .eq('org_id', orgId)
    .single()
  if (error) throw error

  const { data: orgData } = await tbl('organizaciones').select('nombre').eq('id', orgId).single()
  const orgNombre: string = (orgData as any)?.nombre ?? '—'

  const a = data as any
  const visita = a.auditoria_visitas ?? {}
  const ranchoNombre: string = visita.ranchos?.nombre ?? '—'
  const fechaTitulo: string = a.fecha_deteccion ?? a.created_at?.split('T')[0] ?? '—'

  const fotos = (a.accion_correctiva_fotos ?? []) as any[]
  const allPaths = fotos.map((f: any) => f.storage_path as string)
  const uris = await fotosAccionADataUris(allPaths)

  const accionFila: AccionPDFFila = {
    codigo_pregunta: a.codigo_pregunta ?? '—',
    modulo_label: (a.modulo as string).toUpperCase(),
    no_conformidad: a.no_conformidad,
    causa: a.causa,
    accion_correctiva: a.accion_correctiva,
    accion_preventiva: a.accion_preventiva,
    fecha_deteccion: a.fecha_deteccion,
    fecha_cumplimiento: a.fecha_cumplimiento,
    realizo: a.realizo,
    verifico: a.verifico,
    ishikawa: (a.ishikawa as Record<string, string> | null) ?? null,
    fotos: fotos.map((f: any) => ({
      tipo: f.tipo as 'no_conformidad' | 'evidencia_correccion',
      leyenda: f.leyenda ?? null,
      dataUri: uris[f.storage_path] ?? '',
    })),
  }

  return { orgNombre, ranchoNombre, fechaTitulo, acciones: [accionFila] }
}

async function cargarDatosMultiples(
  accionIds: string[],
  orgId: string,
  orgNombre: string,
  ranchoNombre: string,
  fechaTitulo: string,
): Promise<DatosAccionPDF> {
  const { data, error } = await tbl('acciones_correctivas')
    .select('*, accion_correctiva_fotos(id, tipo, storage_path, leyenda)')
    .in('id', accionIds)
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
  if (error) throw error

  const rows = (data ?? []) as any[]
  const allPaths = rows.flatMap((a: any) =>
    ((a.accion_correctiva_fotos ?? []) as any[]).map((f: any) => f.storage_path as string)
  )
  const uris = await fotosAccionADataUris(allPaths)

  const acciones: AccionPDFFila[] = rows.map((a: any) => ({
    codigo_pregunta: a.codigo_pregunta ?? '—',
    modulo_label: (a.modulo as string).toUpperCase(),
    no_conformidad: a.no_conformidad,
    causa: a.causa,
    accion_correctiva: a.accion_correctiva,
    accion_preventiva: a.accion_preventiva,
    fecha_deteccion: a.fecha_deteccion,
    fecha_cumplimiento: a.fecha_cumplimiento,
    realizo: a.realizo,
    verifico: a.verifico,
    ishikawa: (a.ishikawa as Record<string, string> | null) ?? null,
    fotos: ((a.accion_correctiva_fotos ?? []) as any[]).map((f: any) => ({
      tipo: f.tipo as 'no_conformidad' | 'evidencia_correccion',
      leyenda: f.leyenda ?? null,
      dataUri: uris[f.storage_path] ?? '',
    })),
  }))

  return { orgNombre, ranchoNombre, fechaTitulo, acciones }
}

export async function generarAccionCorrectivaIndividualPDF(
  accionId: string,
  orgId: string,
  fecha: string,
): Promise<void> {
  const datos = await cargarDatosAccion(accionId, orgId)
  const blob = await pdf(<AccionesCorrectivasPDF {...datos} />).toBlob()
  descargarBlob(blob, nombrePdf('Acciones_Correctivas', fecha, datos.ranchoNombre))
}

export async function generarAccionesCorrectivasPDF(
  accionIds: string[],
  orgId: string,
  orgNombre: string,
  ranchoNombre: string,
  fechaTitulo: string,
): Promise<void> {
  const datos = await cargarDatosMultiples(accionIds, orgId, orgNombre, ranchoNombre, fechaTitulo)
  const blob = await pdf(<AccionesCorrectivasPDF {...datos} />).toBlob()
  descargarBlob(blob, nombrePdf('Acciones_Correctivas', fechaTitulo, ranchoNombre))
}

export async function generarBlobAccionCorrectiva(accionId: string, orgId: string): Promise<Blob> {
  const datos = await cargarDatosAccion(accionId, orgId)
  return pdf(<AccionesCorrectivasPDF {...datos} />).toBlob()
}
