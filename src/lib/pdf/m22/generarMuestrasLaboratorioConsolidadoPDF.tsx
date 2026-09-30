import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { MuestrasLaboratorioConsolidadoPDF, type MicroorganismoPDF, type MuestraPDF } from './MuestrasLaboratorioPDF'
import { obtenerFirmasParaPdf, firmaDetalleAParaPdf } from '@/hooks/useFirmasRegistro'

async function cargarMicroorganismos(): Promise<MicroorganismoPDF[]> {
  const { data } = await (supabase as any)
    .from('m22_microorganismos')
    .select('*')
    .order('tipo')
    .order('orden')
  return (data ?? []) as MicroorganismoPDF[]
}

export async function generarMuestrasLaboratorioConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  desde: string,
  hasta: string,
  instalacion: string,
  instalacionCodigo: string,
  codigoClave: string,
) {
  const [microorganismos, muestrasRes] = await Promise.all([
    cargarMicroorganismos(),
    (async () => {
      let q = (supabase as any)
        .from('m22_muestras')
        .select('*')
        .eq('org_id', orgId)
        .gte('fecha_muestreo', desde)
        .lte('fecha_muestreo', hasta)
        .order('fecha_muestreo', { ascending: true })
        .order('created_at', { ascending: true })
      if (ranchoId) q = q.eq('rancho_id', ranchoId)
      return q
    })(),
  ])

  const { data, error } = muestrasRes
  if (error) throw error
  if (!data?.length) throw new Error('Sin muestras M22 en el rango seleccionado')

  const muestras: MuestraPDF[] = (data as any[]).map(r => ({
    id: r.id,
    fecha_muestreo: r.fecha_muestreo,
    hora_muestreo: r.hora_muestreo ?? null,
    descripcion_muestra: r.descripcion_muestra,
    microorganismos: r.microorganismos ?? [],
    laboratorio: r.laboratorio,
    solicitante_nombre: r.solicitante_nombre,
  }))

  const ids = muestras.map(m => m.id)
  const firmasMapa = ids.length > 0
    ? await obtenerFirmasParaPdf('M22', ids)
    : {}

  const primeraFirma = ids.length > 0 ? firmasMapa[ids[0]] : undefined
  const firmaRealizo = primeraFirma?.realizo ? firmaDetalleAParaPdf(primeraFirma.realizo) : null
  const firmaVerifico = primeraFirma?.verifico ? firmaDetalleAParaPdf(primeraFirma.verifico) : null

  const blob = await pdf(
    <MuestrasLaboratorioConsolidadoPDF
      instalacion={instalacion}
      instalacionCodigo={instalacionCodigo}
      desde={desde}
      hasta={hasta}
      microorganismos={microorganismos}
      muestras={muestras}
      codigoClave={codigoClave}
      firmaRealizo={firmaRealizo}
      firmaVerifico={firmaVerifico}
    />
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `muestras-laboratorio-${desde}-${hasta}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
