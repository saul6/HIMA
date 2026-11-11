import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { RecepcionDiaPDF, type M82DatosPDF } from './RecepcionPorItemPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { cargarEntregasM82, cargarHojasM82, type M82Bloque, type M82Item, type M82FirmaHoja } from '@/hooks/useM82Recepcion'
import { formatFirmaFecha, type FirmaParaPdf } from '@/hooks/useFirmasRegistro'

const aPdf = (f: M82FirmaHoja | undefined): FirmaParaPdf | null => f ? ({
  png: f.firma_png, firmante: f.nombre, fecha: formatFirmaFecha(f.firmado_en), sello: f.sello, estado: f.al_dia ? 'vigente' : 'desactualizada',
} as FirmaParaPdf) : null

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

/** PDF del día: un solo archivo; solo entregas ACEPTADAS; un juego de hojas por empresa, cada una con sus tres firmas. */
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
  const hojasFirma = await cargarHojasM82(Array.from(new Set(aceptadas.map((e) => e.rancho_id))), fecha)
  const hojas: M82DatosPDF[] = empresas.map((empresa) => {
    const fs = hojasFirma.filter((h) => h.empresa === empresa).flatMap((h) => h.firmas)
    return {
      orgNombre: o.data?.nombre ?? '',
      fecha,
      empresa,
      bloques: (b.data ?? []) as M82Bloque[],
      items: (i.data ?? []) as M82Item[],
      entregas: aceptadas.filter((e) => e.empresa === empresa),
      nombres,
      firmas: { realiza: aPdf(fs.find((f) => f.rol === 'REALIZA')), revisa: aPdf(fs.find((f) => f.rol === 'REVISA')), verifica: aPdf(fs.find((f) => f.rol === 'VERIFICA')) },
    }
  })
  const blob = await pdf(<RecepcionDiaPDF hojas={hojas} codigoClave={codigoClave} />).toBlob()
  descargar(blob, nombrePdf('Recepcion_Por_Item', fecha))
  return empresas.length
}
