// PATRÓN INOCUIDAD — generador PDF consolidado M7
// Obtiene datos de Supabase, agrupa por fecha y descarga un solo documento.

import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { VidrioPlasticoConsolidadoPDF, type VidrioPlasticoPDFProps } from './VidrioPlasticoPDF'
import { obtenerFirmasParaPdf, firmaDetalleAParaPdf } from '@/hooks/useFirmasRegistro'

export async function generarVidrioPlasticoConsolidadoPDF(
  ranchoId: string,
  ranchoNombre: string,
  orgId: string,
  desde: string,
  hasta: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('m7_vidrio_plastico')
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

  // Agrupar por fecha para formar una página por inspección
  // Primer ID de cada fecha = representativo para las firmas
  const inspeccionesMap = new Map<string, VidrioPlasticoPDFProps>()
  const primerosIds = new Map<string, string>() // fecha → primer row.id
  for (const row of data as any[]) {
    const key = row.fecha
    if (!inspeccionesMap.has(key)) {
      inspeccionesMap.set(key, {
        folio: (row.id as string).slice(0, 8).toUpperCase(),
        rancho: row.ranchos?.nombre ?? ranchoNombre,
        ranchoCodigo: row.ranchos?.codigo ?? '—',
        fecha: row.fecha,
        responsableNombre: '',
        materiales: [],
      })
      primerosIds.set(key, row.id)
    }
    inspeccionesMap.get(key)!.materiales.push({
      area: row.area,
      material_equipo: row.material_equipo,
      protegido: row.protegido,
      estado: row.estado,
      observaciones: row.observaciones,
    })
  }

  // Obtener firmas para los IDs representativos de cada inspección
  const idsRepresentativos = Array.from(primerosIds.values())
  const firmasMapa = idsRepresentativos.length > 0
    ? await obtenerFirmasParaPdf('M7', idsRepresentativos)
    : {}

  // Mapear firmas a cada inspección por su ID representativo
  const inspecciones = Array.from(inspeccionesMap.entries()).map(([fecha, insp]) => {
    const priId = primerosIds.get(fecha)
    const firmasInsp = priId ? firmasMapa[priId] : undefined
    return {
      ...insp,
      firmaRealizo: firmasInsp?.realizo ? firmaDetalleAParaPdf(firmasInsp.realizo) : null,
      firmaVerifico: firmasInsp?.verifico ? firmaDetalleAParaPdf(firmasInsp.verifico) : null,
    }
  })

  const desdeSlug = desde.replaceAll('-', '')
  const hastaSlug = hasta.replaceAll('-', '')
  const filename = `vidrio-plastico-consolidado-${desdeSlug}-${hastaSlug}.pdf`

  const blob = await pdf(
    <VidrioPlasticoConsolidadoPDF
      inspecciones={inspecciones}
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
