import { pdf } from '@react-pdf/renderer'
import { Document } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { InventarioQuimicosPagina, type MovimientoPDF } from './InventarioQuimicosPDF'
import { obtenerFirmasParaPdf, firmaDetalleAParaPdf } from '@/hooks/useFirmasRegistro'

export async function generarInventarioQuimicosConsolidadoPDF(
  ranchoId: string,
  orgId: string,
  desde: string,
  hasta: string,
  codigoClave: string,
) {
  const [qRes, mRes] = await Promise.all([
    (supabase as any)
      .from('m24_quimicos')
      .select('id, nombre, unidad, ranchos(nombre)')
      .eq('org_id', orgId)
      .eq('rancho_id', ranchoId)
      .eq('activo', true)
      .order('orden')
      .order('nombre'),
    (supabase as any)
      .from('m24_movimientos')
      .select('id, quimico_id, fecha, persona_solicita, area, tipo, cantidad')
      .eq('org_id', orgId)
      .eq('rancho_id', ranchoId)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: true })
      .order('created_at', { ascending: true }),
  ])
  if (qRes.error) throw qRes.error

  const quimicos: any[] = qRes.data ?? []
  const movsTodos: any[] = mRes.data ?? []
  const instalacion = quimicos[0]?.ranchos?.nombre ?? '—'

  const movPorQuimico = new Map<string, MovimientoPDF[]>()
  const primerMovId = new Map<string, string>()
  for (const m of movsTodos) {
    if (!movPorQuimico.has(m.quimico_id)) {
      movPorQuimico.set(m.quimico_id, [])
      primerMovId.set(m.quimico_id, m.id)
    }
    movPorQuimico.get(m.quimico_id)!.push(m)
  }

  const idsRepresentativos = Array.from(primerMovId.values())
  const firmasMapa = idsRepresentativos.length > 0
    ? await obtenerFirmasParaPdf('M24', idsRepresentativos)
    : {}

  const blob = await pdf(
    <Document>
      {quimicos.map((q: any) => {
        const priId = primerMovId.get(q.id)
        const firmasQ = priId ? firmasMapa[priId] : undefined
        return (
          <InventarioQuimicosPagina
            key={q.id}
            instalacion={instalacion}
            quimicoNombre={q.nombre}
            unidad={q.unidad}
            movimientos={movPorQuimico.get(q.id) ?? []}
            consolidado={true}
            desde={desde}
            hasta={hasta}
            codigoClave={codigoClave}
            firmaRealizo={firmasQ?.realizo ? firmaDetalleAParaPdf(firmasQ.realizo) : null}
            firmaVerifico={firmasQ?.verifico ? firmaDetalleAParaPdf(firmasQ.verifico) : null}
          />
        )
      })}
    </Document>
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inventario-quimicos-consolidado-${desde}-${hasta}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
