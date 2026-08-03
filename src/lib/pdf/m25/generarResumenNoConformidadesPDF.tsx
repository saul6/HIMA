import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { ResumenNoConformidadesPDF, type NcrFila } from './ResumenNoConformidadesPDF'

interface DatosVisita {
  orgNombre: string
  ranchoNombre: string
  fecha: string
  auditorNombre: string
  clienteNombre: string
  paPgfs: string | null
  ncrs: NcrFila[]
}

function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nombre
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function cargarDatosVisita(visitaId: string, orgId: string): Promise<DatosVisita> {
  const [visitaRes, ncrsRes, orgRes] = await Promise.all([
    supabase
      .from('auditoria_visitas')
      .select('*, ranchos(nombre)')
      .eq('id', visitaId)
      .eq('org_id', orgId)
      .single(),
    supabase.rpc('get_no_conformidades', { p_visita_id: visitaId }),
    supabase
      .from('organizaciones')
      .select('nombre')
      .eq('id', orgId)
      .single(),
  ])

  if (visitaRes.error) throw visitaRes.error
  if (ncrsRes.error) throw ncrsRes.error

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = visitaRes.data as any

  return {
    orgNombre: (orgRes.data as any)?.nombre ?? '—',
    ranchoNombre: v.ranchos?.nombre ?? '—',
    fecha: v.fecha,
    auditorNombre: v.auditor_nombre ?? '',
    clienteNombre: v.cliente_nombre ?? '',
    paPgfs: v.pa_pgfs ?? null,
    ncrs: (ncrsRes.data ?? []) as NcrFila[],
  }
}

export async function generarResumenNoConformidadesPDF(
  visitaId: string,
  orgId: string,
  fecha: string
): Promise<void> {
  const datos = await cargarDatosVisita(visitaId, orgId)
  const fechaSlug = fecha.replaceAll('-', '')
  const blob = await pdf(<ResumenNoConformidadesPDF {...datos} />).toBlob()
  descargarBlob(blob, `Resumen_No_Conformidades_${fechaSlug}.pdf`)
}

export async function generarBlobResumenNoConformidades(
  visitaId: string,
  orgId: string
): Promise<Blob> {
  const datos = await cargarDatosVisita(visitaId, orgId)
  return pdf(<ResumenNoConformidadesPDF {...datos} />).toBlob()
}
