import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import {
  EmpleadosGGPDF,
  EmpleadosGGConsolidadoPDF,
  type EmpleadoGGFilaPDF,
} from './EmpleadosGGPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'
import { obtenerFirmasParaPdf, firmaDetalleAParaPdf } from '@/hooks/useFirmasRegistro'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

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

async function fetchEmpleadoById(id: string, orgId: string): Promise<EmpleadoGGFilaPDF> {
  const { data, error } = await tbl('m77_empleados')
    .select('*, ranchos(nombre)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (error) throw error
  const r = data as any
  return {
    id: r.id,
    rancho: r.ranchos?.nombre ?? '—',
    nombre: r.nombre,
    fecha_ingreso: r.fecha_ingreso ?? null,
    telefono: r.telefono ?? null,
    domicilio: r.domicilio ?? null,
    persona_contacto: r.persona_contacto ?? null,
    observaciones: r.observaciones ?? null,
  }
}

export async function generarEmpleadosGGPDF(
  id: string,
  orgId: string,
  _codigoClave?: string,
): Promise<void> {
  const emp = await fetchEmpleadoById(id, orgId)
  const firmasMapa = await obtenerFirmasParaPdf('M77', [id])
  const firmasReg = firmasMapa[id]
  const blob = await pdf(
    <EmpleadosGGPDF
      rancho={emp.rancho}
      empleados={[emp]}
      firmaRealizo={firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null}
    />
  ).toBlob()
  descargar(blob, nombrePdf('EmpleadosGG', emp.fecha_ingreso ?? emp.nombre.slice(0, 10)))
}

export async function generarBlobEmpleadosGG(
  id: string,
  orgId: string,
  _codigoClave?: string,
): Promise<Blob> {
  const emp = await fetchEmpleadoById(id, orgId)
  const firmasMapa = await obtenerFirmasParaPdf('M77', [id])
  const firmasReg = firmasMapa[id]
  return pdf(
    <EmpleadosGGPDF
      rancho={emp.rancho}
      empleados={[emp]}
      firmaRealizo={firmasReg?.realizo ? firmaDetalleAParaPdf(firmasReg.realizo) : null}
    />
  ).toBlob()
}

export async function generarEmpleadosGGConsolidadoPDF(
  orgId: string,
  ranchoId: string | null,
  _orgNombre?: string | null,
  _codigoClave?: string,
): Promise<void> {
  let query = tbl('m77_empleados')
    .select('*, ranchos(nombre)')
    .eq('org_id', orgId)
    .order('nombre', { ascending: true })
  if (ranchoId) query = query.eq('rancho_id', ranchoId)
  const { data, error } = await query
  if (error) throw error
  if (!data?.length) throw new Error('Sin empleados registrados')

  const empleados: EmpleadoGGFilaPDF[] = (data as any[]).map((r) => ({
    id: r.id,
    rancho: r.ranchos?.nombre ?? '—',
    nombre: r.nombre,
    fecha_ingreso: r.fecha_ingreso ?? null,
    telefono: r.telefono ?? null,
    domicilio: r.domicilio ?? null,
    persona_contacto: r.persona_contacto ?? null,
    observaciones: r.observaciones ?? null,
  }))

  const blob = await pdf(
    <EmpleadosGGConsolidadoPDF empleados={empleados} orgNombre={_orgNombre} />
  ).toBlob()
  descargar(blob, nombrePdf('EmpleadosGG-consolidado', new Date().toISOString().slice(0, 10)))
}
