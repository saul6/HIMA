import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { InventarioQuimicosPDF, type MovimientoPDF } from './InventarioQuimicosPDF'

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

export async function generarInventarioQuimicosPDF(quimicoId: string, orgId: string) {
  const { quimico, movimientos } = await cargarDatosQuimico(quimicoId, orgId)
  const blob = await pdf(
    <InventarioQuimicosPDF
      instalacion={quimico.ranchos?.nombre ?? '—'}
      quimicoNombre={quimico.nombre}
      unidad={quimico.unidad}
      movimientos={movimientos}
    />
  ).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inventario-quimicos-${new Date().toISOString().slice(0, 10)}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export async function generarBlobInventarioQuimicos(quimicoId: string, orgId: string): Promise<Blob> {
  const { quimico, movimientos } = await cargarDatosQuimico(quimicoId, orgId)
  return pdf(
    <InventarioQuimicosPDF
      instalacion={quimico.ranchos?.nombre ?? '—'}
      quimicoNombre={quimico.nombre}
      unidad={quimico.unidad}
      movimientos={movimientos}
    />
  ).toBlob()
}
