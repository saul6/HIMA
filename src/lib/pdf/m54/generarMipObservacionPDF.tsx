import { Document } from '@react-pdf/renderer'
import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { MipObservacionPDF, MipObservacionPDFPage, type MipObservacionItemRow } from './MipObservacionPDF'
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

async function cargarM54(id: string, orgId: string) {
  const { data: reg, error: regErr } = await (supabase as any)
    .from('m54_registro')
    .select('*, ranchos(nombre)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (regErr) throw regErr

  const { data: resultados, error: resErr } = await (supabase as any)
    .from('m54_resultados')
    .select('item_id, tecnica_otra, contra_maleza, contra_insectos, contra_enfermedades, contra_vertebrados, comentario')
    .eq('registro_id', id)
  if (resErr) throw resErr

  const { data: catalogo, error: catErr } = await (supabase as any)
    .from('m54_items_catalogo')
    .select('id, numero, texto')
    .eq('activo', true)
    .order('numero', { ascending: true })
  if (catErr) throw catErr

  const resByItemId: Record<string, any> = {}
  const otraRows: any[] = []
  for (const res of (resultados ?? []) as any[]) {
    if (res.item_id) resByItemId[res.item_id] = res
    else if (res.tecnica_otra) otraRows.push(res)
  }

  const items: MipObservacionItemRow[] = [
    ...((catalogo ?? []) as any[]).map((cat: any) => ({
      numero: cat.numero,
      texto: cat.texto,
      contra_maleza: resByItemId[cat.id]?.contra_maleza ?? false,
      contra_insectos: resByItemId[cat.id]?.contra_insectos ?? false,
      contra_enfermedades: resByItemId[cat.id]?.contra_enfermedades ?? false,
      contra_vertebrados: resByItemId[cat.id]?.contra_vertebrados ?? false,
      comentario: resByItemId[cat.id]?.comentario ?? null,
    })),
    ...otraRows.map(o => ({
      numero: null,
      texto: o.tecnica_otra,
      contra_maleza: o.contra_maleza ?? false,
      contra_insectos: o.contra_insectos ?? false,
      contra_enfermedades: o.contra_enfermedades ?? false,
      contra_vertebrados: o.contra_vertebrados ?? false,
      comentario: o.comentario ?? null,
    })),
  ]

  return { reg: reg as any, items }
}

export async function generarMipObservacionPDF(id: string, orgId: string, _codigoClave: string): Promise<void> {
  const { reg, items } = await cargarM54(id, orgId)
  const blob = await pdf(
    <MipObservacionPDF
      rancho={reg.ranchos?.nombre ?? '—'}
      fecha={reg.fecha}
      producto={reg.producto ?? null}
      region={reg.region ?? null}
      realizo={reg.realizo ?? null}
      observaciones={reg.observaciones ?? null}
      items={items}
    />
  ).toBlob()
  descargar(blob, nombrePdf('MIP-Observacion', reg.fecha))
}

export async function generarBlobMipObservacion(id: string, orgId: string, _codigoClave: string): Promise<Blob> {
  const { reg, items } = await cargarM54(id, orgId)
  return pdf(
    <MipObservacionPDF
      rancho={reg.ranchos?.nombre ?? '—'}
      fecha={reg.fecha}
      producto={reg.producto ?? null}
      region={reg.region ?? null}
      realizo={reg.realizo ?? null}
      observaciones={reg.observaciones ?? null}
      items={items}
    />
  ).toBlob()
}

export async function generarMipObservacionConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  ranchoNombre: string,
  orgNombre?: string | null,
  _codigoClave?: string,
): Promise<void> {
  let query = (supabase as any)
    .from('m54_registro')
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

  const { data: catalogo, error: catErr } = await (supabase as any)
    .from('m54_items_catalogo')
    .select('id, numero, texto')
    .eq('activo', true)
    .order('numero', { ascending: true })
  if (catErr) throw catErr

  const pages = await Promise.all(
    (registros as any[]).map(async (reg: any) => {
      const { data: resultados } = await (supabase as any)
        .from('m54_resultados')
        .select('item_id, tecnica_otra, contra_maleza, contra_insectos, contra_enfermedades, contra_vertebrados, comentario')
        .eq('registro_id', reg.id)

      const resByItemId: Record<string, any> = {}
      const otraRows: any[] = []
      for (const res of (resultados ?? []) as any[]) {
        if (res.item_id) resByItemId[res.item_id] = res
        else if (res.tecnica_otra) otraRows.push(res)
      }

      const items: MipObservacionItemRow[] = [
        ...((catalogo ?? []) as any[]).map((cat: any) => ({
          numero: cat.numero,
          texto: cat.texto,
          contra_maleza: resByItemId[cat.id]?.contra_maleza ?? false,
          contra_insectos: resByItemId[cat.id]?.contra_insectos ?? false,
          contra_enfermedades: resByItemId[cat.id]?.contra_enfermedades ?? false,
          contra_vertebrados: resByItemId[cat.id]?.contra_vertebrados ?? false,
          comentario: resByItemId[cat.id]?.comentario ?? null,
        })),
        ...otraRows.map(o => ({
          numero: null,
          texto: o.tecnica_otra,
          contra_maleza: o.contra_maleza ?? false,
          contra_insectos: o.contra_insectos ?? false,
          contra_enfermedades: o.contra_enfermedades ?? false,
          contra_vertebrados: o.contra_vertebrados ?? false,
          comentario: o.comentario ?? null,
        })),
      ]
      return { reg, items }
    })
  )

  const doc = (
    <Document>
      {pages.map(({ reg, items }, idx) => (
        <MipObservacionPDFPage
          key={idx}
          rancho={reg.ranchos?.nombre ?? ranchoNombre}
          orgNombre={orgNombre}
          fecha={reg.fecha}
          producto={reg.producto ?? null}
          region={reg.region ?? null}
          realizo={reg.realizo ?? null}
          observaciones={reg.observaciones ?? null}
          items={items}
        />
      ))}
    </Document>
  )

  const blob = await pdf(doc).toBlob()
  descargar(blob, nombrePdf('MIP-Observacion_consolidado', `${desde}_${hasta}`))
}
