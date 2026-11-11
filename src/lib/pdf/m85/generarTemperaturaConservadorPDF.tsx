import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { TemperaturaConservadorPDF } from './TemperaturaConservadorPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { cargarLecturasM85 } from '@/hooks/useM85Conservador'
import { fechaBitacora } from './conservadorLogica'

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
  orgId: string; desde: string; hasta: string; empresa: string; codigoClave: string; limites: { min: number; max: number }; unidad: 'C' | 'F'
}): Promise<number> {
  // 00:00–00:59 del día siguiente van a la columna 24:00 del último día: se carga un día más y se filtra por día de bitácora
  const sig = new Date(new Date(`${p.hasta}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10)
  const [todas, o, v] = await Promise.all([
    cargarLecturasM85(p.orgId, p.desde, sig),
    (supabase as any).from('organizaciones').select('nombre').eq('id', p.orgId).single(),
    (supabase as any).from('m85_verificaciones').select('fecha, nombre, verificado_en').eq('org_id', p.orgId).gte('fecha', p.desde).lte('fecha', p.hasta),
  ])
  const lecturas = todas.filter((l) => { const f = fechaBitacora(l); return f >= p.desde && f <= p.hasta })
  if (lecturas.length === 0) return 0
  const blob = await pdf(
    <TemperaturaConservadorPDF codigoClave={p.codigoClave}
      d={{ orgNombre: o.data?.nombre ?? '', empresa: p.empresa, desde: p.desde, hasta: p.hasta, limites: p.limites, unidad: p.unidad, lecturas, verificaciones: v.data ?? [] }} />,
  ).toBlob()
  descargar(blob, p.desde === p.hasta ? nombrePdf('Temperatura_Conservador', p.desde) : `Temperatura_Conservador-consolidado-${p.desde}-${p.hasta}.pdf`)
  return lecturas.length
}
