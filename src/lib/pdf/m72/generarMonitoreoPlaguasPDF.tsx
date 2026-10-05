import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  MonitoreoPlaguasPDF,
  MonitoreoPlaguasConsolidadoPDF,
  type MonitoreoPlaguasPDFProps,
  type M72OrganismoPDF,
  type M72FilaPDF,
} from './MonitoreoPlaguasPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { obtenerFirmasParaPdf, firmaDetalleAParaPdf } from '@/hooks/useFirmasRegistro'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

async function construirPaginaM72(
  registroId: string,
  orgId: string,
): Promise<MonitoreoPlaguasPDFProps> {
  const { data: reg, error: regErr } = await tbl('m72_registro')
    .select('*, ranchos(nombre)')
    .eq('id', registroId)
    .single()
  if (regErr) throw regErr
  const r = reg as any

  const { data: resultados, error: resErr } = await tbl('m72_resultados')
    .select('sector, num_planta, organismo_id, conteo, comentario')
    .eq('registro_id', registroId)
    .eq('org_id', orgId)
    .order('sector')
    .order('num_planta')
  if (resErr) throw resErr

  // Collect unique organismo_ids from results
  const orgIds = [...new Set((resultados ?? []).map((x: any) => x.organismo_id as string))]

  let organismos: M72OrganismoPDF[] = []
  if (orgIds.length > 0) {
    const { data: orgData, error: orgErr } = await tbl('m72_organismos')
      .select('id, tipo, nombre')
      .in('id', orgIds)
      .order('tipo')
      .order('nombre')
    if (orgErr) throw orgErr
    organismos = (orgData ?? []) as M72OrganismoPDF[]
  }

  // Group resultados by (sector, num_planta)
  const filaMap = new Map<string, M72FilaPDF>()
  for (const res of (resultados ?? []) as any[]) {
    const key = `${res.sector}__${res.num_planta}`
    if (!filaMap.has(key)) {
      filaMap.set(key, {
        sector: res.sector,
        num_planta: res.num_planta,
        conteos: {},
        comentario: res.comentario ?? null,
      })
    }
    const fila = filaMap.get(key)!
    fila.conteos[res.organismo_id] = res.conteo
    if (res.comentario && !fila.comentario) fila.comentario = res.comentario
  }
  const filas: M72FilaPDF[] = [...filaMap.values()]

  return {
    rancho: r.ranchos?.nombre ?? '—',
    fecha: r.fecha as string,
    etapa_fenologica: r.etapa_fenologica ?? null,
    realizo: r.realizo ?? null,
    beneficos: r.beneficos ?? null,
    observaciones: r.observaciones ?? null,
    organismos,
    filas,
  }
}

export async function generarMonitoreoPlaguasPDF(
  id: string,
  orgId: string,
  _codigoClave?: string,
): Promise<void> {
  const datos = await construirPaginaM72(id, orgId)
  const firmasMapa = await obtenerFirmasParaPdf('M72', [id])
  const firmasReg = firmasMapa[id]
  const blob = await pdf(
    <MonitoreoPlaguasPDF
      {...datos}
      firmaRealizo={firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null}
      firmaVerifico={firmasReg?.verifico ? firmaDetalleAParaPdf(firmasReg.verifico) : null}
    />
  ).toBlob()
  descargar(blob, nombrePdf('MonitoreoPlaguasGG', datos.fecha))
}

export async function generarBlobMonitoreoPlaguasGG(
  id: string,
  orgId: string,
  _codigoClave?: string,
): Promise<Blob> {
  const datos = await construirPaginaM72(id, orgId)
  const firmasMapa = await obtenerFirmasParaPdf('M72', [id])
  const firmasReg = firmasMapa[id]
  return pdf(
    <MonitoreoPlaguasPDF
      {...datos}
      firmaRealizo={firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null}
      firmaVerifico={firmasReg?.verifico ? firmaDetalleAParaPdf(firmasReg.verifico) : null}
    />
  ).toBlob()
}

export async function generarMonitoreoPlaguasConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  _ranchoNombre: string,
  _orgNombre?: string | null,
  _codigoClave?: string,
): Promise<void> {
  let query = tbl('m72_registro')
    .select('id, fecha')
    .eq('org_id', orgId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
  if (ranchoId) query = query.eq('rancho_id', ranchoId)
  const { data: registros, error } = await query
  if (error) throw error
  if (!registros?.length) throw new Error('Sin registros en el rango seleccionado')

  const paginas = await Promise.all(
    (registros as any[]).map(r => construirPaginaM72(r.id, orgId))
  )
  const ids = (registros as any[]).map(r => r.id)
  const firmasMapa = await obtenerFirmasParaPdf('M72', ids)

  const paginasConFirmas: MonitoreoPlaguasPDFProps[] = paginas.map((p, i) => {
    const firmasReg = firmasMapa[ids[i]]
    return {
      ...p,
      orgNombre: _orgNombre,
      firmaRealizo: firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null,
      firmaVerifico: firmasReg?.verifico ? firmaDetalleAParaPdf(firmasReg.verifico) : null,
    }
  })

  const blob = await pdf(
    <MonitoreoPlaguasConsolidadoPDF paginas={paginasConFirmas} />
  ).toBlob()
  descargar(blob, nombrePdf('MonitoreoPlaguasGG_consolidado', `${desde}_${hasta}`))
}
