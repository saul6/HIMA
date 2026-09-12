import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { ProductosAutorizadosPDF, type ProductoAutorizadoRow } from './ProductosAutorizadosPDF'

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

export async function generarProductosAutorizadosPDF(
  orgId: string,
  orgNombre: string,
  codigoClave: string,
  cultivoFiltro?: string | null,
): Promise<void> {
  let query = (supabase as any)
    .from('m66_productos_autorizados')
    .select('cultivo, ingrediente_activo, nombre_comercial, concentracion, empresa, dosis_ha, intervalo_seguridad_dias, plagas_control, mercado')
    .eq('org_id', orgId)
    .eq('activo', true)
    .order('cultivo', { ascending: true })
    .order('nombre_comercial', { ascending: true })

  if (cultivoFiltro) query = query.eq('cultivo', cultivoFiltro)

  const { data, error } = await query
  if (error) throw error

  const productos: ProductoAutorizadoRow[] = (data ?? []).map((r: any) => ({
    cultivo: r.cultivo,
    ingrediente_activo: r.ingrediente_activo,
    nombre_comercial: r.nombre_comercial,
    concentracion: r.concentracion,
    empresa: r.empresa,
    dosis_ha: r.dosis_ha,
    intervalo_seguridad_dias: r.intervalo_seguridad_dias ?? null,
    plagas_control: r.plagas_control,
    mercado: r.mercado,
  }))

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const blob = await pdf(
    <ProductosAutorizadosPDF
      orgNombre={orgNombre}
      productos={productos}
      codigoClave={codigoClave}
      cultivoFiltro={cultivoFiltro}
      fecha={hoy}
    />
  ).toBlob()

  const sufijo = cultivoFiltro
    ? cultivoFiltro.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_')
    : 'todos'
  descargar(blob, `Productos_Autorizados_${sufijo}_${hoy}.pdf`)
}
