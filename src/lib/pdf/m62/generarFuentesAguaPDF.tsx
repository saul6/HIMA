import { Document } from '@react-pdf/renderer'
import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { FuentesAguaPDF, FuentesAguaPage, type FuentesAguaItemRow } from './FuentesAguaPDF'
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

async function cargarM62(id: string, orgId: string) {
  const { data: reg, error: regErr } = await (supabase as any)
    .from('m62_registro')
    .select('*, ranchos(nombre)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (regErr) throw regErr

  const { data: resultados, error: resErr } = await (supabase as any)
    .from('m62_resultados')
    .select('item_id, respuesta, comentario')
    .eq('registro_id', id)
  if (resErr) throw resErr

  const { data: catalogo, error: catErr } = await (supabase as any)
    .from('m62_items_catalogo')
    .select('id, numero, descripcion')
    .order('numero', { ascending: true })
  if (catErr) throw catErr

  const resByItemId: Record<string, { respuesta: 'si' | 'no' | 'na'; comentario: string | null }> = {}
  for (const res of (resultados ?? []) as any[]) {
    resByItemId[res.item_id] = { respuesta: res.respuesta, comentario: res.comentario ?? null }
  }

  const items: FuentesAguaItemRow[] = ((catalogo ?? []) as any[]).map((cat: any) => ({
    numero: cat.numero,
    descripcion: cat.descripcion,
    respuesta: resByItemId[cat.id]?.respuesta ?? 'na',
    comentario: resByItemId[cat.id]?.comentario ?? null,
  }))

  return { reg: reg as any, items }
}

export async function generarFuentesAguaPDF(id: string, orgId: string, _codigoClave: string): Promise<void> {
  const { reg, items } = await cargarM62(id, orgId)
  const blob = await pdf(
    <FuentesAguaPDF
      rancho={reg.ranchos?.nombre ?? '—'}
      fecha={reg.fecha}
      tipo_fuente={reg.tipo_fuente ?? null}
      realizo={reg.realizo ?? null}
      observaciones={reg.observaciones ?? null}
      items={items}
    />
  ).toBlob()
  descargar(blob, nombrePdf('FuentesAgua', reg.fecha))
}

export async function generarBlobFuentesAgua(id: string, orgId: string, _codigoClave: string): Promise<Blob> {
  const { reg, items } = await cargarM62(id, orgId)
  return pdf(
    <FuentesAguaPDF
      rancho={reg.ranchos?.nombre ?? '—'}
      fecha={reg.fecha}
      tipo_fuente={reg.tipo_fuente ?? null}
      realizo={reg.realizo ?? null}
      observaciones={reg.observaciones ?? null}
      items={items}
    />
  ).toBlob()
}

export async function generarFuentesAguaConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  ranchoNombre: string,
  orgNombre?: string | null,
  _codigoClave?: string,
): Promise<void> {
  let query = (supabase as any)
    .from('m62_registro')
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
    .from('m62_items_catalogo')
    .select('id, numero, descripcion')
    .order('numero', { ascending: true })
  if (catErr) throw catErr

  const pages = await Promise.all(
    (registros as any[]).map(async (reg: any) => {
      const { data: resultados } = await (supabase as any)
        .from('m62_resultados')
        .select('item_id, respuesta, comentario')
        .eq('registro_id', reg.id)

      const resByItemId: Record<string, { respuesta: 'si' | 'no' | 'na'; comentario: string | null }> = {}
      for (const res of (resultados ?? []) as any[]) {
        resByItemId[res.item_id] = { respuesta: res.respuesta, comentario: res.comentario ?? null }
      }
      const items: FuentesAguaItemRow[] = ((catalogo ?? []) as any[]).map((cat: any) => ({
        numero: cat.numero,
        descripcion: cat.descripcion,
        respuesta: resByItemId[cat.id]?.respuesta ?? 'na',
        comentario: resByItemId[cat.id]?.comentario ?? null,
      }))

      return { reg, items }
    })
  )

  const doc = (
    <Document>
      {pages.map(({ reg, items }, idx) => (
        <FuentesAguaPage
          key={idx}
          rancho={reg.ranchos?.nombre ?? ranchoNombre}
          orgNombre={orgNombre}
          fecha={reg.fecha}
          tipo_fuente={reg.tipo_fuente ?? null}
          realizo={reg.realizo ?? null}
          observaciones={reg.observaciones ?? null}
          items={items}
        />
      ))}
    </Document>
  )

  const blob = await pdf(doc).toBlob()
  descargar(blob, nombrePdf('FuentesAgua_consolidado', `${desde}_${hasta}`))
}
