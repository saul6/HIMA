import { pdf } from '@react-pdf/renderer'
import { InventarioReg01PDF } from './InventarioReg01PDF'
import type { GrupoProductoReg01 } from './InventarioReg01PDF'
import { getMovimientosRanchoReg01, getOrganizacion } from '@/lib/queries'

interface GenerarProps {
  orgId: string
  ranchoId: string
  ranchoNombre: string
  cultivo: string | null
  desde?: string
  hasta?: string
}

export async function generarInventarioReg01PDF({
  orgId,
  ranchoId,
  ranchoNombre,
  cultivo,
  desde,
  hasta,
}: GenerarProps): Promise<void> {
  const [movimientos, org] = await Promise.all([
    getMovimientosRanchoReg01(ranchoId, desde, hasta),
    getOrganizacion(orgId),
  ])

  const productoMap = new Map<string, { nombreComercial: string; unidad: string | null; movimientos: any[] }>()
  for (const m of movimientos) {
    if (!productoMap.has(m.producto_id)) {
      productoMap.set(m.producto_id, {
        nombreComercial: m.catalogo_productos.nombre_comercial,
        unidad: m.catalogo_productos.unidad,
        movimientos: [],
      })
    }
    productoMap.get(m.producto_id)!.movimientos.push(m)
  }

  const grupos: GrupoProductoReg01[] = Array.from(productoMap.entries()).map(([productoId, g]) => ({
    productoId,
    nombreComercial: g.nombreComercial,
    unidad: g.unidad,
    movimientos: g.movimientos,
  }))

  const blob = await pdf(
    <InventarioReg01PDF
      orgNombre={org.nombre}
      ranchoNombre={ranchoNombre}
      cultivo={cultivo}
      grupos={grupos}
      desde={desde}
      hasta={hasta}
    />
  ).toBlob()

  const sufijo = desde
    ? hasta ? `${desde}_al_${hasta}` : desde
    : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const filename = `Inventario-Insumos-${sufijo}.pdf`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
