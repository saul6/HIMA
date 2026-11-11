import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { RecepcionPorItemPDF, type M82DatosPDF } from './RecepcionPorItemPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { cargarEntregasM82, type M82Bloque, type M82Item } from '@/hooks/useM82Recepcion'

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

/** PDF del día: solo entregas ACEPTADAS; un juego de hojas por empresa dueña de la fruta. */
export async function generarRecepcionPorItemPDF(orgId: string, fecha: string, codigoClave: string): Promise<number> {
  const [entregas, b, i, o] = await Promise.all([
    cargarEntregasM82(orgId, fecha),
    tbl('m82_bloques').select('*').eq('org_id', orgId).order('orden'),
    tbl('m82_items_catalogo').select('id, bloque_id, codigo, presentacion, clasificacion, orden').eq('org_id', orgId),
    tbl('organizaciones').select('nombre').eq('id', orgId).single(),
  ])
  const aceptadas = entregas.filter((e) => e.estado === 'ACEPTADA')
  if (aceptadas.length === 0) return 0
  const ids = Array.from(new Set(aceptadas.map((e) => e.creado_por).filter(Boolean))) as string[]
  const nombres: Record<string, string> = {}
  if (ids.length) {
    const { data } = await tbl('profiles').select('id, nombre_completo').in('id', ids)
    for (const p of data ?? []) nombres[p.id] = p.nombre_completo ?? ''
  }
  const empresas = Array.from(new Set(aceptadas.map((e) => e.empresa))).sort()
  for (const empresa of empresas) {
    const d: M82DatosPDF = {
      orgNombre: o.data?.nombre ?? '',
      fecha,
      empresa,
      bloques: (b.data ?? []) as M82Bloque[],
      items: (i.data ?? []) as M82Item[],
      entregas: aceptadas.filter((e) => e.empresa === empresa),
      nombres,
    }
    const blob = await pdf(<RecepcionPorItemPDF d={d} codigoClave={codigoClave} />).toBlob()
    const sufijo = empresas.length > 1 ? `_${empresas.indexOf(empresa) + 1}` : ''
    descargar(blob, nombrePdf(`Recepcion_Por_Item${sufijo}`, fecha))
  }
  return empresas.length
}
