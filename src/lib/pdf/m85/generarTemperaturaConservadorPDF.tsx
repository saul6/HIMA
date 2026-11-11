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

type ParamsM85 = { orgId: string; desde: string; hasta: string; empresa: string; codigoClave: string; limites: { min: number; max: number }; unidad: 'C' | 'F' }

/** PDF del periodo como Blob (null si no hay lecturas). La empresa del encabezado la indica el usuario. */
export async function blobTemperaturaConservador(p: ParamsM85): Promise<Blob | null> {
  // 00:00–00:59 del día siguiente van a la columna 24:00 del último día: se carga un día más y se filtra por día de bitácora
  const sig = new Date(new Date(`${p.hasta}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10)
  const [todas, o, v] = await Promise.all([
    cargarLecturasM85(p.orgId, p.desde, sig),
    (supabase as any).from('organizaciones').select('nombre').eq('id', p.orgId).single(),
    (supabase as any).from('m85_verificaciones').select('fecha, nombre, verificado_en').eq('org_id', p.orgId).gte('fecha', p.desde).lte('fecha', p.hasta),
  ])
  const lecturas = todas.filter((l) => { const f = fechaBitacora(l); return f >= p.desde && f <= p.hasta })
  if (lecturas.length === 0) return null
  return pdf(
    <TemperaturaConservadorPDF codigoClave={p.codigoClave}
      d={{ orgNombre: o.data?.nombre ?? '', empresa: p.empresa, desde: p.desde, hasta: p.hasta, limites: p.limites, unidad: p.unidad, lecturas, verificaciones: v.data ?? [] }} />,
  ).toBlob()
}

/** PDF del periodo (descarga): un día o consolidado. Devuelve 0 si no hay lecturas. */
export async function generarTemperaturaConservadorPDF(p: ParamsM85): Promise<number> {
  const blob = await blobTemperaturaConservador(p)
  if (!blob) return 0
  descargar(blob, p.desde === p.hasta ? nombrePdf('Temperatura_Conservador', p.desde) : `Temperatura_Conservador-consolidado-${p.desde}-${p.hasta}.pdf`)
  return 1
}

/** Para el Historial: un día con la configuración de la organización; la empresa del encabezado sale de la recepción de ese día. */
export async function blobTemperaturaConservadorDia(orgId: string, fecha: string, codigoClave: string): Promise<Blob> {
  const [c, e] = await Promise.all([
    (supabase as any).from('m85_config').select('limite_min, limite_max, unidad').eq('org_id', orgId).maybeSingle(),
    (supabase as any).from('m82_entregas').select('empresa').eq('org_id', orgId).eq('fecha', fecha).eq('estado', 'ACEPTADA'),
  ])
  const cuenta = new Map<string, number>()
  for (const x of (e.data ?? []) as { empresa: string }[]) cuenta.set(x.empresa, (cuenta.get(x.empresa) ?? 0) + 1)
  const empresa = Array.from(cuenta.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  const blob = await blobTemperaturaConservador({ orgId, desde: fecha, hasta: fecha, empresa, codigoClave,
    limites: { min: Number(c.data?.limite_min ?? -5), max: Number(c.data?.limite_max ?? 15) }, unidad: (c.data?.unidad ?? 'C') as 'C' | 'F' })
  if (!blob) throw new Error('Sin lecturas del conservador en esa fecha')
  return blob
}
