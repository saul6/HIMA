import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { PreparacionCloroPDF, type PreparacionPDFRow } from './PreparacionCloroPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'

interface GenerarProps {
  rancho: string
  orgNombre?: string | null
  fecha: string
  area: string
  litros_agua: number
  ml_cloro: number
  responsable: string | null
  observaciones: string | null
}

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

export async function generarPreparacionCloroPDF(props: GenerarProps, codigoClave: string): Promise<void> {
  const filename = nombrePdf('Preparacion_de_Cloro', props.fecha, props.rancho)
  const row: PreparacionPDFRow = {
    fecha: props.fecha,
    area: props.area,
    litros_agua: props.litros_agua,
    ml_cloro: props.ml_cloro,
    responsable: props.responsable,
    observaciones: props.observaciones,
  }
  const blob = await pdf(
    <PreparacionCloroPDF
      rancho={props.rancho}
      orgNombre={props.orgNombre}
      desde={props.fecha}
      hasta={props.fecha}
      preparaciones={[row]}
      codigoClave={codigoClave}
    />
  ).toBlob()
  descargar(blob, filename)
}

export async function generarBlobPreparacionCloro(id: string, orgId: string, codigoClave: string): Promise<Blob> {
  const { data, error } = await (supabase as any)
    .from('m27_preparaciones')
    .select('*, ranchos(nombre)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (error) throw error
  const r = data as any
  const row: PreparacionPDFRow = {
    fecha: r.fecha,
    area: r.area,
    litros_agua: r.litros_agua,
    ml_cloro: r.ml_cloro,
    responsable: r.responsable ?? null,
    observaciones: r.observaciones ?? null,
  }
  return pdf(
    <PreparacionCloroPDF
      rancho={r.ranchos?.nombre ?? '—'}
      desde={r.fecha}
      hasta={r.fecha}
      preparaciones={[row]}
      codigoClave={codigoClave}
    />
  ).toBlob()
}
