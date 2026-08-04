// Generador M21 — Revisión de Estaciones de Monitoreo de Plagas.
// construirDatosM21: arma MonitoreoEstacionesPaginaProps desde la BD.
// generarMonitoreoEstacionesPDF: descarga individual.
// generarBlobMonitoreoEstaciones: Blob para fusión en BibliotecaHistorial.

import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  MonitoreoEstacionesPDF,
  MonitoreoEstacionesPaginaProps,
  GrupoEstacionesPDF,
  CatalogoCodigo,
  EstacionResultadoPDF,
} from './MonitoreoEstacionesPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'

// ── Orden y etiquetas por tipo de trampa ──────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  cebo:     'Trampas con Cebo',
  interior: 'Interiores',
  mecanica: 'Mecanicas',
  luz:      'Trampa de Luz',
}

const TIPO_ORDER = ['cebo', 'interior', 'mecanica', 'luz']

// ── Consulta + construccion de datos ─────────────────────────────────────────

export async function construirDatosM21(
  revisionId: string,
  orgId: string,
): Promise<MonitoreoEstacionesPaginaProps> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('m21_revision')
    .select('*, ranchos(nombre, codigo), m21_resultado(*, m21_estaciones(numero, tipo_trampa, orden))')
    .eq('id', revisionId)
    .eq('org_id', orgId)
    .single()
  if (error) throw error

  const [
    { data: catalogoEstadoRaw, error: errEstado },
    { data: catalogoCondicionesRaw, error: errCond },
    { data: catalogoPlAgasRaw, error: errPlagas },
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('m21_estado_trampa').select('codigo, label').order('codigo'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('m21_condiciones').select('codigo, label').order('codigo'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('m21_plagas').select('codigo, label').order('codigo'),
  ])
  if (errEstado) throw errEstado
  if (errCond) throw errCond
  if (errPlagas) throw errPlagas

  const catalogoEstado: CatalogoCodigo[] = catalogoEstadoRaw ?? []
  const catalogoCondiciones: CatalogoCodigo[] = catalogoCondicionesRaw ?? []
  const catalogoPlagas: CatalogoCodigo[] = catalogoPlAgasRaw ?? []

  const r = data as any
  const resultados: any[] = r.m21_resultado ?? []

  // Agrupar por tipo_trampa
  const porTipo: Record<string, EstacionResultadoPDF[]> = {}
  for (const res of resultados) {
    const estacion = res.m21_estaciones
    if (!estacion) continue
    const tipo: string = estacion.tipo_trampa ?? 'cebo'
    if (!porTipo[tipo]) porTipo[tipo] = []
    porTipo[tipo].push({
      numero: estacion.numero ?? '',
      tipo_consumo: res.tipo_consumo ?? null,
      estado_trampa: res.estado_trampa ?? null,
      condiciones: res.condiciones ?? null,
      senalizacion: res.senalizacion ?? null,
      estado_equipo: res.estado_equipo ?? null,
      estado_lampara: res.estado_lampara ?? null,
      plaga_detectada: res.plaga_detectada ?? [],
      tiene_hallazgo: res.tiene_hallazgo ?? false,
      _orden: estacion.orden ?? 0,
      _numero: estacion.numero ?? '',
    } as any)
  }

  // Ordenar estaciones dentro de cada grupo
  for (const tipo of Object.keys(porTipo)) {
    porTipo[tipo].sort((a: any, b: any) => {
      if (a._orden !== b._orden) return a._orden - b._orden
      return String(a._numero).localeCompare(String(b._numero))
    })
    // Limpiar campos internos de ordenamiento
    porTipo[tipo] = porTipo[tipo].map((e: any) => {
      const { _orden: _o, _numero: _n, ...rest } = e
      return rest as EstacionResultadoPDF
    })
  }

  // Construir grupos solo con los tipos que tengan resultados, en orden definido
  const grupos: GrupoEstacionesPDF[] = TIPO_ORDER
    .filter((tipo) => porTipo[tipo] && porTipo[tipo].length > 0)
    .map((tipo) => ({
      tipo_trampa: tipo as GrupoEstacionesPDF['tipo_trampa'],
      label: TIPO_LABEL[tipo] ?? tipo,
      estaciones: porTipo[tipo],
    }))

  return {
    folio: (revisionId as string).slice(0, 8).toUpperCase(),
    instalacion: r.ranchos?.nombre ?? '—',
    instalacionCodigo: r.ranchos?.codigo ?? '—',
    fecha: r.fecha,
    inspector: r.inspector_nombre ?? null,
    observaciones: r.observaciones ?? null,
    grupos,
    catalogoEstado,
    catalogoCondiciones,
    catalogoPlagas,
  }
}

// ── Descarga individual ───────────────────────────────────────────────────────

export async function generarMonitoreoEstacionesPDF(
  revisionId: string,
  orgId: string,
): Promise<void> {
  const datos = await construirDatosM21(revisionId, orgId)
  const blob = await pdf(<MonitoreoEstacionesPDF {...datos} />).toBlob()

  const filename = nombrePdf('Monitoreo_Plagas', datos.fecha, datos.instalacion)

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Blob para BibliotecaHistorial ─────────────────────────────────────────────

export async function generarBlobMonitoreoEstaciones(
  revisionId: string,
  orgId: string,
): Promise<Blob> {
  const datos = await construirDatosM21(revisionId, orgId)
  return pdf(<MonitoreoEstacionesPDF {...datos} />).toBlob()
}
