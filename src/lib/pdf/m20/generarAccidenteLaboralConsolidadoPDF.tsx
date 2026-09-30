// Generador consolidado M20 — Accidentes Laborales.
// Agrupa múltiples accidentes en un solo PDF por rango de fechas.

import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { AccidenteLaboralConsolidadoPDF } from './AccidenteLaboralPDF'
import { construirDatosM20 } from './generarAccidenteLaboralPDF'
import { obtenerFirmasParaPdf, firmaDetalleAParaPdf } from '@/hooks/useFirmasRegistro'

export async function generarAccidenteLaboralConsolidadoPDF(
  ranchoId: string,
  instalacionNombre: string,
  orgId: string,
  desde: string,    // YYYY-MM-DD
  hasta: string,    // YYYY-MM-DD
  codigoClave: string,
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

  const rowIds = (data as any[]).map((row: any) => row.id as string)
  const registrosBase = await Promise.all(
    rowIds.map((id) => construirDatosM20(id, orgId))
  )

  const firmasMapa = rowIds.length > 0
    ? await obtenerFirmasParaPdf('M20', rowIds)
    : {}

  const registros = registrosBase.map((reg, i) => {
    const firmas = firmasMapa[rowIds[i]]
    return {
      ...reg,
      firmaRealizo: firmas?.realizo ? firmaDetalleAParaPdf(firmas.realizo) : null,
      firmaVerifico: firmas?.verifico ? firmaDetalleAParaPdf(firmas.verifico) : null,
    }
  })

  const blob = await pdf(
    <AccidenteLaboralConsolidadoPDF
      registros={registros}
      instalacionNombre={instalacionNombre}
      desde={desde}
      hasta={hasta}
      codigoClave={codigoClave}
    />
  ).toBlob()

  const filename = `accidentes-laborales-${desde}-${hasta}.pdf`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
