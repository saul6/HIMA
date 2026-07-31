// Generador consolidado M20 — Accidentes Laborales.
// Agrupa múltiples accidentes en un solo PDF por rango de fechas.

import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { AccidenteLaboralConsolidadoPDF } from './AccidenteLaboralPDF'
import { construirDatosM20 } from './generarAccidenteLaboralPDF'

export async function generarAccidenteLaboralConsolidadoPDF(
  ranchoId: string,
  instalacionNombre: string,
  orgId: string,
  desde: string,    // YYYY-MM-DD
  hasta: string,    // YYYY-MM-DD
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('m20_accidentes')
    .select('id')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
  if (error) throw error
  if (!data?.length) throw new Error('Sin registros M20 en el rango seleccionado')

  const registros = await Promise.all(
    (data as any[]).map((row: any) => construirDatosM20(row.id as string, orgId))
  )

  const blob = await pdf(
    <AccidenteLaboralConsolidadoPDF
      registros={registros}
      instalacionNombre={instalacionNombre}
      desde={desde}
      hasta={hasta}
    />
  ).toBlob()

  const instSlug = instalacionNombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const filename = `accidentes-laborales-${instSlug}-${desde}-${hasta}.pdf`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
