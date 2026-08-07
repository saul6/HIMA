import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  InspeccionAlmacenEmpaquePDF,
  type InspeccionAlmacenEmpaquePaginaProps,
  type M43PuntoPDFRow,
} from './InspeccionAlmacenEmpaquePDF'

function formatMesLabel(mes: string): string {
  try {
    return new Date(mes + 'T12:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  } catch { return mes }
}

export async function construirDatosPaginaM43(
  registroId: string,
  orgId: string,
): Promise<InspeccionAlmacenEmpaquePaginaProps> {
  const tbl = supabase as any
  const [
    { data: reg,       error: rErr },
    { data: puntosData, error: pErr },
    { data: diasData,   error: dErr },
    { data: resData,    error: resErr },
  ] = await Promise.all([
    tbl
      .from('m43_registro_mensual')
      .select('id, mes, realizado_por, verifica, autoriza, observaciones, ranchos(nombre, codigo)')
      .eq('id', registroId)
      .eq('org_id', orgId)
      .single(),
    tbl
      .from('m43_puntos')
      .select('id, orden, texto')
      .order('orden'),
    tbl
      .from('m43_dias')
      .select('id, dia, acciones_tomadas')
      .eq('registro_id', registroId)
      .eq('org_id', orgId)
      .order('dia'),
    tbl
      .from('m43_resultados')
      .select('punto_id, dia, valor')
      .eq('registro_id', registroId)
      .eq('org_id', orgId),
  ])
  if (rErr)   throw rErr
  if (pErr)   throw pErr
  if (dErr)   throw dErr
  if (resErr) throw resErr

  const r = reg as any
  const puntos: M43PuntoPDFRow[] = ((puntosData ?? []) as any[]).map((p: any) => ({
    id:     p.id,
    orden:  p.orden,
    texto:  p.texto,
  }))

  const dias: any[] = ((diasData ?? []) as any[]).sort((a: any, b: any) => a.dia - b.dia)
  const diasInspeccionados: number[] = dias.map((d: any) => d.dia as number)

  const matriz: Record<number, Record<string, string>> = {}
  const accionesTomadas: Record<number, string>        = {}

  for (const dia of dias) {
    matriz[dia.dia] = {}
    if (dia.acciones_tomadas) accionesTomadas[dia.dia] = dia.acciones_tomadas
  }
  for (const res of (resData ?? []) as any[]) {
    const d = res.dia as number
    if (!matriz[d]) matriz[d] = {}
    matriz[d][res.punto_id] = res.valor
  }

  return {
    instalacion:       (r.ranchos as any)?.nombre ?? '—',
    instalacionCodigo: (r.ranchos as any)?.codigo ?? '—',
    mesLabel:          formatMesLabel(r.mes),
    mesDate:           r.mes,
    realizadoPor:      r.realizado_por ?? null,
    verifica:          r.verifica ?? null,
    autoriza:          r.autoriza ?? null,
    observaciones:     r.observaciones ?? null,
    puntos,
    diasInspeccionados,
    matriz,
    accionesTomadas,
  }
}

export async function generarInspeccionAlmacenEmpaquePDF(
  registroId: string,
  orgId: string,
): Promise<void> {
  const datos = await construirDatosPaginaM43(registroId, orgId)
  const blob  = await pdf(<InspeccionAlmacenEmpaquePDF {...datos} />).toBlob()
  const url   = URL.createObjectURL(blob)
  const a     = document.createElement('a')
  a.href      = url
  a.download  = `Inspeccion_Almacen_Empaque-${datos.mesDate}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export async function generarBlobInspeccionAlmacenEmpaque(
  registroId: string,
  orgId: string,
): Promise<Blob> {
  const datos = await construirDatosPaginaM43(registroId, orgId)
  return pdf(<InspeccionAlmacenEmpaquePDF {...datos} />).toBlob()
}
