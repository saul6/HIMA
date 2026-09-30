// PATRÓN INOCUIDAD — generador PDF consolidado M8
// Obtiene datos de Supabase, agrupa por fecha y descarga un solo documento.

import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { FertilizacionConsolidadoPDF, type FertilizacionPDFProps } from './FertilizacionPDF'
import { obtenerFirmasParaPdf, firmaDetalleAParaPdf } from '@/hooks/useFirmasRegistro'

export async function generarFertilizacionConsolidadoPDF(
  ranchoId: string,
  ranchoNombre: string,
  orgId: string,
  desde: string,
  hasta: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('m8_fertilizacion')
    .select('*, ranchos(nombre, codigo)')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No hay registros en ese rango para el rancho seleccionado')
  }

  // Agrupar por fecha para formar una página por jornada
  // Primer ID de cada fecha = representativo para las firmas
  const registrosMap = new Map<string, FertilizacionPDFProps>()
  const primerosIds = new Map<string, string>() // fecha → primer row.id
  for (const row of data as any[]) {
    const key = row.fecha
    if (!registrosMap.has(key)) {
      registrosMap.set(key, {
        folio: (row.id as string).slice(0, 8).toUpperCase(),
        rancho: row.ranchos?.nombre ?? ranchoNombre,
        ranchoCodigo: row.ranchos?.codigo ?? '—',
        fecha: row.fecha,
        sector: row.sector,
        responsableNombre: '',
        fertilizantes: [],
      })
      primerosIds.set(key, row.id)
    }
    registrosMap.get(key)!.fertilizantes.push({
      nombre_comercial: row.nombre_comercial,
      ingrediente_activo: row.ingrediente_activo,
      concentracion: row.concentracion,
      metodo: row.metodo,
      superficie_ha: row.superficie_ha,
      dosis_kg_l_ha: row.dosis_kg_l_ha,
      cantidad_total: row.cantidad_total,
    })
  }

  // Obtener firmas para los IDs representativos de cada jornada
  const idsRepresentativos = Array.from(primerosIds.values())
  const firmasMapa = idsRepresentativos.length > 0
    ? await obtenerFirmasParaPdf('M8', idsRepresentativos)
    : {}

  // Mapear firmas a cada jornada por su ID representativo
  const registros = Array.from(registrosMap.entries()).map(([fecha, reg]) => {
    const priId = primerosIds.get(fecha)
    const firmasReg = priId ? firmasMapa[priId] : undefined
    return {
      ...reg,
      firmaRealizo: firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null,
      firmaVerifico: firmasReg?.verifico ? firmaDetalleAParaPdf(firmasReg.verifico) : null,
    }
  })

  const desdeSlug = desde.replaceAll('-', '')
  const hastaSlug = hasta.replaceAll('-', '')
  const filename = `fertilizacion-consolidado-${desdeSlug}-${hastaSlug}.pdf`

  const blob = await pdf(
    <FertilizacionConsolidadoPDF
      registros={registros}
      ranchoNombre={ranchoNombre}
      desde={desde}
      hasta={hasta}
    />
  ).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
