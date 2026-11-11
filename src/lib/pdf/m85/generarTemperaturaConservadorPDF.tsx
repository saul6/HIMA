import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { TemperaturaConservadorPDF } from './TemperaturaConservadorPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { cargarLecturasM85 } from '@/hooks/useM85Conservador'

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

/** PDF del periodo. La empresa del encabezado la indica el usuario: la lectura es física y no pertenece a una empresa. */
export async function generarTemperaturaConservadorPDF(p: {
  orgId: string; desde: string; hasta: string; empresa: string; codigoClave: string; limites: { min: number; max: number }
}): Promise<number> {
  const [lecturas, o] = await Promise.all([
    cargarLecturasM85(p.orgId, p.desde, p.hasta),
    (supabase as any).from('organizaciones').select('nombre').eq('id', p.orgId).single(),
  ])
  if (lecturas.length === 0) return 0
  const blob = await pdf(
    <TemperaturaConservadorPDF codigoClave={p.codigoClave}
      d={{ orgNombre: o.data?.nombre ?? '', empresa: p.empresa, desde: p.desde, hasta: p.hasta, limites: p.limites, lecturas }} />,
  ).toBlob()
  descargar(blob, p.desde === p.hasta ? nombrePdf('Temperatura_Conservador', p.desde) : `Temperatura_Conservador-consolidado-${p.desde}-${p.hasta}.pdf`)
  return lecturas.length
}
