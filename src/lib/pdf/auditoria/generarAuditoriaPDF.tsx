import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { AuditoriaPDF, AuditoriaConsolidadoPDF, type AuditoriaPaginaProps } from './AuditoriaPDF'
import type { ModuloAuditoria } from '@/hooks/useAuditoria'
import { nombrePdf } from '@/lib/pdf/nombrePdf'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

function moduloPdfNombre(modulo: ModuloAuditoria): string {
  if (modulo === 'm14') return 'Auditoria_SAIA'
  if (modulo === 'm15') return 'Auditoria_Granja'
  if (modulo === 'm16') return 'Auditoria_Cuadrilla'
  if (modulo === 'm17') return 'BPM'
  return 'HACCP'
}

async function construirDatosAuditoria(
  auditoriaId: string,
  orgId: string,
  modulo: ModuloAuditoria
): Promise<AuditoriaPaginaProps> {
  const [audRes, secRes, preRes, respRes] = await Promise.all([
    tbl(`${modulo}_auditorias`)
      .select('id, rancho_id, fecha, auditor_nombre, puntos_obtenidos, puntos_posibles, porcentaje, portada, ranchos(nombre, codigo)')
      .eq('id', auditoriaId)
      .eq('org_id', orgId)
      .single(),
    tbl(`${modulo}_secciones`)
      .select('id, codigo, nombre, orden')
      .order('orden', { ascending: true }),
    tbl(`${modulo}_preguntas`)
      .select('id, seccion_id, codigo, texto, puntos, orden_seccion')
      .order('orden_seccion', { ascending: true }),
    tbl(`${modulo}_respuestas`)
      .select('pregunta_id, respuesta, comentario, puntos_otorgados')
      .eq('auditoria_id', auditoriaId),
  ])

  if (audRes.error) throw audRes.error
  if (secRes.error) throw secRes.error
  if (preRes.error) throw preRes.error
  if (respRes.error) throw respRes.error

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = audRes.data as any

  return {
    modulo,
    auditoriaId: a.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ranchoNombre: (a.ranchos as any)?.nombre ?? '—',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ranchoCodigo: (a.ranchos as any)?.codigo ?? '—',
    fecha: a.fecha,
    auditorNombre: a.auditor_nombre ?? null,
    puntos_obtenidos: a.puntos_obtenidos,
    puntos_posibles: a.puntos_posibles,
    porcentaje: a.porcentaje,
    portada: a.portada ?? null,
    secciones: secRes.data ?? [],
    preguntas: preRes.data ?? [],
    respuestas: respRes.data ?? [],
  }
}

export async function generarBlobAuditoria(
  auditoriaId: string,
  orgId: string,
  modulo: ModuloAuditoria
): Promise<Blob> {
  const datos = await construirDatosAuditoria(auditoriaId, orgId, modulo)
  return pdf(<AuditoriaPDF {...datos} />).toBlob()
}

export async function generarAuditoriaPDF(
  auditoriaId: string,
  orgId: string,
  modulo: ModuloAuditoria,
  ranchoNombre: string,
  fecha: string
): Promise<void> {
  const datos = await construirDatosAuditoria(auditoriaId, orgId, modulo)
  const blob = await pdf(<AuditoriaPDF {...datos} />).toBlob()
  const filename = nombrePdf(moduloPdfNombre(modulo), fecha, ranchoNombre)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function generarAuditoriaConsolidadoPDF(
  modulo: ModuloAuditoria,
  orgId: string,
  desde: string,
  hasta: string,
  ranchoId?: string
): Promise<void> {
  let q = tbl(`${modulo}_auditorias`)
    .select('id')
    .eq('org_id', orgId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false })

  if (ranchoId) q = q.eq('rancho_id', ranchoId)

  const { data, error } = await q
  if (error) throw error
  if (!data?.length) throw new Error('No hay auditorias en el rango seleccionado')

  const todas = await Promise.all(
    (data as { id: string }[]).map((a) => construirDatosAuditoria(a.id, orgId, modulo))
  )

  const blob = await pdf(
    <AuditoriaConsolidadoPDF auditorias={todas} modulo={modulo} />
  ).toBlob()

  const filename = `${moduloPdfNombre(modulo)}_${desde}_${hasta}_consolidado.pdf`
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ── V2 — fetches from aud_* tables ───────────────────────────────────────────

async function construirDatosAuditoriaV2(
  auditoriaId: string,
  modulo: ModuloAuditoria
): Promise<AuditoriaPaginaProps> {
  // Fetch auditoria + rancho
  const { data: audData, error: audErr } = await tbl('aud_auditorias')
    .select('id, rancho_id, fecha, auditor_nombre, ranchos(nombre, codigo), aud_auditoria_modulos(modulo_norma_id)')
    .eq('id', auditoriaId)
    .single()
  if (audErr) throw audErr

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aud = audData as any
  const moduloNormaId: string | null = aud.aud_auditoria_modulos?.[0]?.modulo_norma_id ?? null

  // Fetch bloques for this modulo_norma_id
  let bloquesData: { id: string; codigo: string; nombre: string; orden: number }[] = []
  let preguntasData: { id: string; bloque_id: string; codigo: string; prompt_texto: string; max_puntos: number; orden: number }[] = []

  if (moduloNormaId) {
    const { data: blRaw, error: blErr } = await tbl('aud_bloques')
      .select('id, codigo, nombre, orden').eq('modulo_norma_id', moduloNormaId).order('orden')
    if (blErr) throw blErr
    bloquesData = blRaw ?? []

    const { data: preRaw, error: preErr } = await tbl('aud_preguntas')
      .select('id, bloque_id, codigo, prompt_texto, max_puntos, orden')
      .eq('modulo_norma_id', moduloNormaId).order('orden')
    if (preErr) throw preErr
    preguntasData = preRaw ?? []
  }

  // Fetch instancias (responses)
  const { data: instRaw, error: instErr } = await tbl('aud_instancia_pregunta')
    .select('id, pregunta_id, respuesta')
    .eq('auditoria_id', auditoriaId)
  if (instErr) throw instErr

  // Fetch valores para construir comentarios
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instancias = (instRaw ?? []) as any[]
  const instIds = instancias.map((i: { id: string }) => i.id)

  const comentariosMap = new Map<string, string>()
  if (instIds.length > 0) {
    const { data: valRaw } = await tbl('aud_instancia_valores')
      .select('instancia_id, valor_texto')
      .in('instancia_id', instIds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instIdToPreg = new Map(instancias.map((i: any) => [i.id, i.pregunta_id]))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const val of (valRaw ?? []) as any[]) {
      if (!val.valor_texto) continue
      const pregId = instIdToPreg.get(val.instancia_id)
      if (!pregId) continue
      const prev = comentariosMap.get(pregId)
      comentariosMap.set(pregId, prev ? `${prev}\n${val.valor_texto}` : val.valor_texto)
    }
  }

  return {
    modulo,
    auditoriaId: aud.id,
    ranchoNombre: aud.ranchos?.nombre ?? '—',
    ranchoCodigo: aud.ranchos?.codigo ?? '—',
    fecha: aud.fecha,
    auditorNombre: aud.auditor_nombre ?? null,
    puntos_obtenidos: 0,
    puntos_posibles: 0,
    porcentaje: 0,
    portada: null,
    secciones: bloquesData.map((b) => ({ id: b.id, codigo: b.codigo, nombre: b.nombre, orden: b.orden })),
    preguntas: preguntasData.map((p) => ({
      id: p.id,
      seccion_id: p.bloque_id,
      codigo: p.codigo,
      texto: p.prompt_texto,
      puntos: p.max_puntos,
      orden_seccion: p.orden,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    respuestas: instancias.map((i: any) => ({
      pregunta_id: i.pregunta_id,
      respuesta: i.respuesta,
      comentario: comentariosMap.get(i.pregunta_id) ?? null,
      puntos_otorgados: 0,
    })),
  }
}

export async function generarBlobAuditoriaV2(
  auditoriaId: string,
  modulo: ModuloAuditoria,
): Promise<Blob> {
  const datos = await construirDatosAuditoriaV2(auditoriaId, modulo)
  return pdf(<AuditoriaPDF {...datos} />).toBlob()
}

export async function generarAuditoriaV2PDF(
  auditoriaId: string,
  modulo: ModuloAuditoria,
  ranchoNombre: string,
  fecha: string,
): Promise<void> {
  const datos = await construirDatosAuditoriaV2(auditoriaId, modulo)
  const blob = await pdf(<AuditoriaPDF {...datos} />).toBlob()
  const filename = nombrePdf(moduloPdfNombre(modulo), fecha, ranchoNombre)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function generarAuditoriaV2ConsolidadoPDF(
  modulo: ModuloAuditoria,
  desde: string,
  hasta: string,
  ranchoId?: string,
): Promise<void> {
  // Fetch auditoria IDs for this modulo+daterange via aud_auditoria_modulos
  // We need the modulo_norma_id first
  const { data: verData } = await tbl('aud_versiones_norma').select('id').eq('vigente', true).single()
  const versionId = verData?.id
  if (!versionId) throw new Error('No hay versión vigente de la norma')

  const APP_CODIGO: Record<ModuloAuditoria, string> = {
    m14: 'M14', m15: 'M15', m16: 'M16', m17: 'M17', m18: 'M18',
  }
  const { data: modData } = await tbl('aud_modulos_norma')
    .select('id').eq('version_id', versionId).eq('app_modulo_codigo', APP_CODIGO[modulo]).single()
  const moduloNormaId = modData?.id
  if (!moduloNormaId) throw new Error(`Módulo ${APP_CODIGO[modulo]} no encontrado en la norma vigente`)

  let q = tbl('aud_auditorias')
    .select('id, aud_auditoria_modulos!inner(modulo_norma_id)')
    .eq('aud_auditoria_modulos.modulo_norma_id', moduloNormaId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false })

  if (ranchoId) q = q.eq('rancho_id', ranchoId)

  const { data, error } = await q
  if (error) throw error
  if (!data?.length) throw new Error('No hay auditorías en el rango seleccionado')

  const todas = await Promise.all(
    (data as { id: string }[]).map((a) => construirDatosAuditoriaV2(a.id, modulo))
  )

  const blob = await pdf(
    <AuditoriaConsolidadoPDF auditorias={todas} modulo={modulo} />
  ).toBlob()

  const filename = `${moduloPdfNombre(modulo)}_${desde}_${hasta}_consolidado.pdf`
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
