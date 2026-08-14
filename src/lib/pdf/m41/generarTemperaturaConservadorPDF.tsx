import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { TemperaturaConservadorPDF, type M41RegistroDataPDF, type M41LecturaPDF } from './TemperaturaConservadorPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'

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

async function cargarDatos(id: string, orgId: string): Promise<M41RegistroDataPDF> {
  const [regRes, linRes, orgRes] = await Promise.all([
    (supabase as any).from('m41_registros')
      .select('*, ranchos(nombre)')
      .eq('id', id).eq('org_id', orgId).single(),
    (supabase as any).from('m41_lecturas')
      .select('hora, temperatura')
      .eq('registro_id', id).eq('org_id', orgId).order('hora'),
    (supabase as any).from('organizaciones')
      .select('nombre').eq('id', orgId).single(),
  ])
  if (regRes.error) throw regRes.error
  if (linRes.error) throw linRes.error

  const r = regRes.data as any
  const lecturas: M41LecturaPDF[] = ((linRes.data ?? []) as any[]).map(l => ({
    hora: l.hora,
    temperatura: l.temperatura ?? null,
  }))

  return {
    orgNombre: orgRes.data?.nombre ?? '—',
    instalacion: r.ranchos?.nombre ?? '—',
    fecha: r.fecha,
    temp_min: r.temp_min ?? null,
    temp_max: r.temp_max ?? null,
    observaciones: r.observaciones ?? null,
    lecturas,
  }
}

export async function generarTemperaturaConservadorPDF(id: string, orgId: string, codigoClave: string): Promise<void> {
  const d = await cargarDatos(id, orgId)
  const blob = await pdf(<TemperaturaConservadorPDF d={d} codigoClave={codigoClave} />).toBlob()
  descargar(blob, nombrePdf('Temperaturas_Conservador', d.fecha, d.instalacion))
}

export async function generarBlobTemperaturaConservador(id: string, orgId: string, codigoClave: string): Promise<Blob> {
  const d = await cargarDatos(id, orgId)
  return pdf(<TemperaturaConservadorPDF d={d} codigoClave={codigoClave} />).toBlob()
}
