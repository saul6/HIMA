import { Document } from '@react-pdf/renderer'
import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { MonitoreoRoedoresPDF, MonitoreoRoedoresPage, type M68MatrizRow } from './MonitoreoRoedoresPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'

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

async function cargarM68(id: string, orgId: string) {
  const { data: reg, error: regErr } = await (supabase as any)
    .from('m68_roedores_registro')
    .select('*, ranchos(nombre)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (regErr) throw regErr

  const { data: resultados, error: resErr } = await (supabase as any)
    .from('m68_roedores_resultados')
    .select('criterio_id, trampa_numero, cumple')
    .eq('registro_id', id)
  if (resErr) throw resErr

  const { data: criterios, error: catErr } = await (supabase as any)
    .from('m68_roedores_criterios')
    .select('id, numero, descripcion')
    .eq('activo', true)
    .order('numero', { ascending: true })
  if (catErr) throw catErr

  const numTrampas: number = (reg as any).num_trampas ?? 8
  const cumpleMap: Record<string, boolean> = {}
  for (const r of (resultados ?? []) as any[]) {
    cumpleMap[`${r.criterio_id}_${r.trampa_numero}`] = r.cumple
  }

  const matriz: M68MatrizRow[] = ((criterios ?? []) as any[]).map((c: any) => ({
    criterio_numero: c.numero,
    criterio_descripcion: c.descripcion,
    trampas: Array.from({ length: numTrampas }, (_, i) => cumpleMap[`${c.id}_${i + 1}`] ?? false),
  }))

  return { reg: reg as any, matriz, numTrampas }
}

export async function generarMonitoreoRoedoresPDF(id: string, orgId: string, _codigoClave?: string): Promise<void> {
  const { reg, matriz, numTrampas } = await cargarM68(id, orgId)
  const blob = await pdf(
    <MonitoreoRoedoresPDF
      rancho={reg.ranchos?.nombre ?? '—'}
      fecha={reg.fecha}
      ubicacion={reg.ubicacion}
      responsable={reg.responsable ?? null}
      observaciones={reg.observaciones ?? null}
      matriz={matriz}
      num_trampas={numTrampas}
    />
  ).toBlob()
  descargar(blob, nombrePdf('MonitoreoRoedores', reg.fecha))
}

export async function generarBlobMonitoreoRoedores(id: string, orgId: string, _codigoClave?: string): Promise<Blob> {
  const { reg, matriz, numTrampas } = await cargarM68(id, orgId)
  return pdf(
    <MonitoreoRoedoresPDF
      rancho={reg.ranchos?.nombre ?? '—'}
      fecha={reg.fecha}
      ubicacion={reg.ubicacion}
      responsable={reg.responsable ?? null}
      observaciones={reg.observaciones ?? null}
      matriz={matriz}
      num_trampas={numTrampas}
    />
  ).toBlob()
}

export async function generarMonitoreoRoedoresConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  ranchoNombre: string,
  orgNombre?: string | null,
  _codigoClave?: string,
): Promise<void> {
  let query = (supabase as any)
    .from('m68_roedores_registro')
    .select('*, ranchos(nombre)')
    .eq('org_id', orgId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })
  if (ranchoId) query = query.eq('rancho_id', ranchoId)

  const { data: registros, error: regErr } = await query
  if (regErr) throw regErr
  if (!registros?.length) throw new Error('Sin registros en el rango seleccionado')

  const { data: criterios, error: catErr } = await (supabase as any)
    .from('m68_roedores_criterios')
    .select('id, numero, descripcion')
    .eq('activo', true)
    .order('numero', { ascending: true })
  if (catErr) throw catErr

  const pages = await Promise.all(
    (registros as any[]).map(async (reg: any) => {
      const { data: resultados } = await (supabase as any)
        .from('m68_roedores_resultados')
        .select('criterio_id, trampa_numero, cumple')
        .eq('registro_id', reg.id)

      const numTrampas: number = reg.num_trampas ?? 8
      const cumpleMap: Record<string, boolean> = {}
      for (const r of (resultados ?? []) as any[]) {
        cumpleMap[`${r.criterio_id}_${r.trampa_numero}`] = r.cumple
      }

      const matriz: M68MatrizRow[] = ((criterios ?? []) as any[]).map((c: any) => ({
        criterio_numero: c.numero,
        criterio_descripcion: c.descripcion,
        trampas: Array.from({ length: numTrampas }, (_, i) => cumpleMap[`${c.id}_${i + 1}`] ?? false),
      }))

      return { reg, matriz, numTrampas }
    })
  )

  const doc = (
    <Document>
      {pages.map(({ reg, matriz, numTrampas }, idx) => (
        <MonitoreoRoedoresPage
          key={idx}
          rancho={reg.ranchos?.nombre ?? ranchoNombre}
          orgNombre={orgNombre}
          fecha={reg.fecha}
          ubicacion={reg.ubicacion}
          responsable={reg.responsable ?? null}
          observaciones={reg.observaciones ?? null}
          matriz={matriz}
          num_trampas={numTrampas}
        />
      ))}
    </Document>
  )

  const blob = await pdf(doc).toBlob()
  descargar(blob, nombrePdf('MonitoreoRoedores_consolidado', `${desde}_${hasta}`))
}
