import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { AuditoriaPDF, AuditoriaConsolidadoPDF, type AuditoriaPaginaProps } from './AuditoriaPDF'
import type { ModuloAuditoria } from '@/hooks/useAuditoria'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

function moduloLabel(modulo: ModuloAuditoria): string {
  if (modulo === 'm14') return 'saia'
  if (modulo === 'm15') return 'granja'
  if (modulo === 'm16') return 'cosecha'
  if (modulo === 'm17') return 'bpm'
  return 'haccp'
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
  const filename = `auditoria-${moduloLabel(modulo)}-${fecha.replaceAll('-', '')}.pdf`
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

  const filename = `auditoria-${moduloLabel(modulo)}-consolidado-${desde.replaceAll('-', '')}-${hasta.replaceAll('-', '')}.pdf`
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
