import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { MuestrasLaboratorioPDF, MuestrasLaboratorioPagina, type MicroorganismoPDF, type MuestraPDF } from './MuestrasLaboratorioPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'

async function cargarMicroorganismos(): Promise<MicroorganismoPDF[]> {
  const { data } = await (supabase as any)
    .from('m22_microorganismos')
    .select('*')
    .order('tipo')
    .order('orden')
  return (data ?? []) as MicroorganismoPDF[]
}

async function cargarMuestra(id: string, orgId: string) {
  const { data, error } = await (supabase as any)
    .from('m22_muestras')
    .select('*, ranchos(nombre, codigo)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (error) throw error
  return data as any
}

export async function construirDatosM22(id: string, orgId: string) {
  const [muestra, microorganismos] = await Promise.all([
    cargarMuestra(id, orgId),
    cargarMicroorganismos(),
  ])
  const muestraPDF: MuestraPDF = {
    id: muestra.id,
    fecha_muestreo: muestra.fecha_muestreo,
    hora_muestreo: muestra.hora_muestreo ?? null,
    descripcion_muestra: muestra.descripcion_muestra,
    microorganismos: muestra.microorganismos ?? [],
    laboratorio: muestra.laboratorio,
    solicitante_nombre: muestra.solicitante_nombre,
  }
  return {
    instalacion: muestra.ranchos?.nombre ?? '—',
    instalacionCodigo: muestra.ranchos?.codigo ?? '—',
    fecha: muestra.fecha_muestreo,
    microorganismos,
    muestras: [muestraPDF],
  }
}

export async function generarMuestrasLaboratorioPDF(id: string, orgId: string) {
  const datos = await construirDatosM22(id, orgId)
  const blob = await pdf(<MuestrasLaboratorioPDF {...datos} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombrePdf('Muestras_Laboratorio', datos.fecha, datos.instalacion)
  a.click()
  URL.revokeObjectURL(url)
}

export async function generarBlobMuestrasLaboratorio(id: string, orgId: string): Promise<Blob> {
  const datos = await construirDatosM22(id, orgId)
  return pdf(<MuestrasLaboratorioPDF {...datos} />).toBlob()
}
