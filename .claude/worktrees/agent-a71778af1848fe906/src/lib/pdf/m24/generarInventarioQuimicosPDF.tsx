import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { InventarioQuimicosPDF, type MovimientoPDF } from './InventarioQuimicosPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { hoyMX } from '@/lib/fecha'

async function cargarDatosQuimico(quimicoId: string, orgId: string) {
  const [qRes, mRes] = await Promise.all([
    (supabase as any)
      .from('m24_quimicos')
      .select('*, ranchos(nombre)')
      .eq('id', quimicoId)
      .eq('org_id', orgId)
      .single(),
    (supabase as any)
      .from('m24_movimientos')
      .select('fecha, persona_solicita, area, tipo, cantidad')
      .eq('org_id', orgId)
      .eq('quimico_id', quimicoId)
      .order('fecha', { ascending: true })
      .order('created_at', { ascending: true }),
  ])
  if (qRes.error) throw qRes.error
  return {
    quimico: qRes.data as any,
    movimientos: (mRes.data ?? []) as MovimientoPDF[],
  }
}

export async function generarInventarioQuimicosPDF(quimicoId: string, orgId: string, codigoClave: string) {
  const { quimico, movimientos } = await cargarDatosQuimico(quimicoId, orgId)
  const blob = await pdf(
    <InventarioQuimicosPDF
      instalacion={quimico.ranchos?.nombre ?? '—'}
      quimicoNombre={quimico.nombre}
      unidad={quimico.unidad}
      movimientos={movimientos}
      codigoClave={codigoClave}
    />
  ).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombrePdf('Inventario_Quimicos', hoyMX(), quimico.ranchos?.nombre)
  a.click()
  URL.revokeObjectURL(url)
}

export async function generarBlobInventarioQuimicos(quimicoId: string, orgId: string, codigoClave: string): Promise<Blob> {
  const { quimico, movimientos } = await cargarDatosQuimico(quimicoId, orgId)
  return pdf(
    <InventarioQuimicosPDF
      instalacion={quimico.ranchos?.nombre ?? '—'}
      quimicoNombre={quimico.nombre}
      unidad={quimico.unidad}
      movimientos={movimientos}
      codigoClave={codigoClave}
    />
  ).toBlob()
}
