// Generador M20 — Accidentes Laborales.
// construirDatosM20: arma AccidenteLaboralPaginaProps desde la BD (con fotos).
// generarAccidenteLaboralPDF: descarga individual.
// generarBlobAccidenteLaboral: Blob para fusión en BibliotecaHistorial.

import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { fotosADataUris } from '@/lib/pdf/m13/incidenciasPdfImagenes'
import { AccidenteLaboralPDF, AccidenteLaboralPaginaProps } from './AccidenteLaboralPDF'

// ── Consulta + construccion de datos ─────────────────────────────────────────

export async function construirDatosM20(
  accidenteId: string,
  orgId: string,
): Promise<AccidenteLaboralPaginaProps> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('m20_accidentes')
    .select('*, ranchos(nombre, codigo), m20_accidente_fotos(id, storage_path, orden)')
    .eq('id', accidenteId)
    .eq('org_id', orgId)
    .single()
  if (error) throw error

  const r = data as any
  const fotosSorted = ((r.m20_accidente_fotos ?? []) as any[])
    .sort((a: any, b: any) => a.orden - b.orden)

  const paths = fotosSorted.map((f: any) => f.storage_path as string)
  const urisPorPath = await fotosADataUris(paths)
  const dataUris = paths.map((p: string) => urisPorPath[p] ?? '')

  return {
    folio: (accidenteId as string).slice(0, 8).toUpperCase(),
    instalacion: r.ranchos?.nombre ?? '—',
    instalacionCodigo: r.ranchos?.codigo ?? '—',
    fecha: r.fecha,
    trabajadorNombre: r.trabajador_nombre ?? '—',
    descripcionIncidente: r.descripcion_incidente ?? '',
    atencionRecibida: r.atencion_recibida ?? [],
    requirioIncapacidad: r.requirio_incapacidad ?? false,
    incapacidadMotivo: r.incapacidad_motivo ?? null,
    requirioLimpieza: r.requirio_limpieza ?? false,
    limpiezaDescripcion: r.limpieza_descripcion ?? null,
    productoInvolucrado: r.producto_involucrado ?? false,
    disposicionProducto: r.disposicion_producto ?? null,
    dataUris,
  }
}

// ── Descarga individual ───────────────────────────────────────────────────────

export async function generarAccidenteLaboralPDF(
  accidenteId: string,
  orgId: string,
): Promise<void> {
  const datos = await construirDatosM20(accidenteId, orgId)
  const blob = await pdf(<AccidenteLaboralPDF {...datos} />).toBlob()

  const instSlug = datos.instalacion.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const filename = `accidente-laboral-${datos.fecha}-${instSlug}.pdf`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Blob para BibliotecaHistorial ─────────────────────────────────────────────

export async function generarBlobAccidenteLaboral(
  accidenteId: string,
  orgId: string,
): Promise<Blob> {
  const datos = await construirDatosM20(accidenteId, orgId)
  return pdf(<AccidenteLaboralPDF {...datos} />).toBlob()
}
