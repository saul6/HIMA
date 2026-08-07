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
  const [{ data: reg, error: rErr }, { data: puntosData, error: pErr }] = await Promise.all([
    tbl
      .from('m43_registro_mensual')
      .select(`
        id, mes, realizado_por, verifica, autoriza, observaciones,
        ranchos(nombre, codigo),
        m43_dias(id, fecha, acciones_tomadas, m43_resultados(punto_id, valor))
      `)
      .eq('id', registroId)
      .eq('org_id', orgId)
      .single(),
    tbl
      .from('m43_puntos')
      .select('id, orden, descripcion')
      .order('orden'),
  ])
  if (rErr) throw rErr
  if (pErr) throw pErr

  const r = reg as any
  const puntos: M43PuntoPDFRow[] = ((puntosData ?? []) as any[]).map((p: any) => ({
    id:          p.id,
    orden:       p.orden,
    descripcion: p.descripcion,
  }))

  const dias: any[] = ((r.m43_dias ?? []) as any[]).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
  const diasInspeccionados = dias.map((d: any) => d.fecha as string)

  const matriz: Record<string, Record<string, string>> = {}
  const accionesTomadas: Record<string, string>         = {}
  for (const dia of dias) {
    matriz[dia.fecha] = {}
    if (dia.acciones_tomadas) accionesTomadas[dia.fecha] = dia.acciones_tomadas
    for (const res of (dia.m43_resultados ?? []) as any[]) {
      matriz[dia.fecha][res.punto_id] = res.valor
    }
  }

  return {
    instalacion:      (r.ranchos as any)?.nombre ?? '—',
    instalacionCodigo:(r.ranchos as any)?.codigo ?? '—',
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
