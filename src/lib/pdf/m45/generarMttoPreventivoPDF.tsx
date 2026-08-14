import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  MttoPreventivoPDF,
  MttoPreventivoConsolidadoPDF,
  type M45PaginaProps,
  type M45AreaPDF,
  type M45AccionesPDF,
} from './MttoPreventivoPDF'

export async function construirDatosM45(
  registroId: string,
  orgId: string,
  codigoClave: string,
): Promise<M45PaginaProps> {
  const tbl = supabase as any
  const [
    { data: reg, error: rErr },
    { data: itemsData, error: iErr },
    { data: resData },
    { data: accData },
  ] = await Promise.all([
    tbl.from('m45_registro_mensual')
      .select('id, anio, mes, observaciones, ranchos(nombre, codigo)')
      .eq('id', registroId)
      .eq('org_id', orgId)
      .single(),
    tbl.from('m45_items')
      .select('id, area, nombre, frecuencia, orden')
      .eq('activo', true)
      .order('area')
      .order('orden'),
    tbl.from('m45_resultados')
      .select('item_id, dia, valor')
      .eq('registro_id', registroId)
      .eq('org_id', orgId),
    tbl.from('m45_acciones')
      .select('item_id, revision_general, cambio_aceites, cambio_piezas, revision_electrico')
      .eq('registro_id', registroId)
      .eq('org_id', orgId),
  ])
  if (rErr) throw rErr
  if (iErr) throw iErr

  const r    = reg as any
  const anio = r.anio as number
  const mes  = r.mes  as number

  // Build areas preserving DB order (order by area, orden)
  const areasMap = new Map<string, M45AreaPDF>()
  for (const item of (itemsData ?? []) as any[]) {
    if (!areasMap.has(item.area)) {
      areasMap.set(item.area, { area: item.area, items: [] })
    }
    areasMap.get(item.area)!.items.push({
      id:        item.id,
      nombre:    item.nombre,
      frecuencia: item.frecuencia,
      orden:     item.orden,
    })
  }
  const areas: M45AreaPDF[] = Array.from(areasMap.values())

  // Resultados: item_id → dia → valor
  const resultados: Record<string, Record<number, string>> = {}
  for (const res of (resData ?? []) as any[]) {
    if (!resultados[res.item_id]) resultados[res.item_id] = {}
    resultados[res.item_id][res.dia as number] = res.valor
  }

  // Acciones: item_id → AccionesPDF
  const acciones: Record<string, M45AccionesPDF> = {}
  for (const a of (accData ?? []) as any[]) {
    acciones[a.item_id] = {
      revision_general:  a.revision_general,
      cambio_aceites:    a.cambio_aceites,
      cambio_piezas:     a.cambio_piezas,
      revision_electrico: a.revision_electrico,
    }
  }

  const mesLabel = new Date(anio, mes - 1, 1).toLocaleDateString('es-MX', {
    month: 'long', year: 'numeric',
  })

  return {
    instalacion:      (r.ranchos as any)?.nombre ?? '—',
    instalacionCodigo: (r.ranchos as any)?.codigo ?? '—',
    anio,
    mes,
    mesLabel,
    observaciones: r.observaciones ?? null,
    areas,
    resultados,
    acciones,
    codigoClave,
  }
}

export async function generarMttoPreventivoPDF(
  registroId: string,
  orgId: string,
  codigoClave: string,
): Promise<void> {
  const datos = await construirDatosM45(registroId, orgId, codigoClave)
  const blob  = await pdf(<MttoPreventivoPDF {...datos} />).toBlob()
  const url   = URL.createObjectURL(blob)
  const a     = document.createElement('a')
  a.href      = url
  a.download  = `Mantenimiento_Preventivo-${datos.anio}-${String(datos.mes).padStart(2, '0')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export async function generarBlobMttoPreventivo(
  registroId: string,
  orgId: string,
  codigoClave: string,
): Promise<Blob> {
  const datos = await construirDatosM45(registroId, orgId, codigoClave)
  return pdf(<MttoPreventivoPDF {...datos} />).toBlob()
}

export async function generarMttoPreventivoConsolidadoPDF(
  ranchoId: string,
  instalacionNombre: string,
  orgId: string,
  desde: string,   // YYYY-MM
  hasta: string,   // YYYY-MM
  codigoClave: string,
): Promise<void> {
  const tbl = supabase as any
  const desdeAnio = parseInt(desde.slice(0, 4))
  const hastaAnio = parseInt(hasta.slice(0, 4))

  const { data, error } = await tbl
    .from('m45_registro_mensual')
    .select('id, anio, mes')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .gte('anio', desdeAnio)
    .lte('anio', hastaAnio)
    .order('anio', { ascending: true })
    .order('mes',  { ascending: true })
  if (error) throw error

  // Filter to exact month range
  const desdeVal = desdeAnio * 12 + parseInt(desde.slice(5, 7))
  const hastaVal = hastaAnio * 12 + parseInt(hasta.slice(5, 7))
  const filtrados = ((data ?? []) as any[]).filter((r: any) => {
    const v = (r.anio as number) * 12 + (r.mes as number)
    return v >= desdeVal && v <= hastaVal
  })

  if (!filtrados.length) throw new Error('Sin registros en el rango seleccionado')

  const paginas = await Promise.all(filtrados.map((r: any) => construirDatosM45(r.id, orgId, codigoClave)))

  const blob = await pdf(
    <MttoPreventivoConsolidadoPDF
      paginas={paginas}
      instalacionNombre={instalacionNombre}
      desde={desde}
      hasta={hasta}
    />
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href    = url
  a.download = `Mantenimiento_Preventivo-consolidado-${desde}-${hasta}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
