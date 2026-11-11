import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { PrefrioTurbinasPDF } from './PrefrioTurbinasPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { cargarGruposM83 } from '@/hooks/useM83Prefrio'

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

/** PDF del día (fecha de entrada): un archivo por empresa dueña de la fruta. Devuelve cuántos generó. */
export async function generarPrefrioTurbinasPDF(orgId: string, fecha: string, codigoClave: string): Promise<number> {
  const [grupos, o] = await Promise.all([
    cargarGruposM83(orgId, fecha),
    (supabase as any).from('organizaciones').select('nombre').eq('id', orgId).single(),
  ])
  if (grupos.length === 0) return 0
  const empresas = Array.from(new Set(grupos.map((g) => g.empresa))).sort()
  for (const [k, empresa] of empresas.entries()) {
    const blob = await pdf(
      <PrefrioTurbinasPDF codigoClave={codigoClave}
        d={{ orgNombre: o.data?.nombre ?? '', fecha, empresa, grupos: grupos.filter((g) => g.empresa === empresa) }} />,
    ).toBlob()
    descargar(blob, nombrePdf(`Prefrio${empresas.length > 1 ? `_${k + 1}` : ''}`, fecha))
  }
  return empresas.length
}
