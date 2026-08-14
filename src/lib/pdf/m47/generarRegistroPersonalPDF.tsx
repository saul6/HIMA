import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { hoyMX } from '@/lib/fecha'
import {
  RegistroPersonalPDF,
  type M47TrabajadorPDF,
  type M47ItemPDF,
} from './RegistroPersonalPDF'
import { nombrePdf } from '@/lib/pdf/nombrePdf'

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

async function cargarDatos(ranchoId: string, orgId: string) {
  const [trabajadoresRes, itemsRes, orgRes, ranchoRes] = await Promise.all([
    tbl('m47_trabajadores')
      .select('*, m47_checklist(item_id, valor)')
      .eq('org_id', orgId)
      .eq('rancho_id', ranchoId)
      .order('nombre'),
    tbl('m47_items')
      .select('id, tipo, nombre, orden')
      .eq('org_id', orgId)
      .eq('rancho_id', ranchoId)
      .eq('activo', true)
      .order('tipo')
      .order('orden'),
    tbl('organizaciones').select('nombre').eq('id', orgId).single(),
    tbl('ranchos').select('nombre').eq('id', ranchoId).single(),
  ])
  if (trabajadoresRes.error) throw trabajadoresRes.error
  if (itemsRes.error) throw itemsRes.error

  const rawTrabajadores: any[] = trabajadoresRes.data ?? []
  const rawItems: any[] = itemsRes.data ?? []
  const orgNombre: string = orgRes.data?.nombre ?? '—'
  const ranchoNombre: string = ranchoRes.data?.nombre ?? '—'

  const documentos: M47ItemPDF[] = rawItems
    .filter((i) => i.tipo === 'documento')
    .map((i) => ({ id: i.id as string, nombre: i.nombre as string }))

  const capacitaciones: M47ItemPDF[] = rawItems
    .filter((i) => i.tipo === 'capacitacion')
    .map((i) => ({ id: i.id as string, nombre: i.nombre as string }))

  const trabajadores: M47TrabajadorPDF[] = rawTrabajadores.map((r, idx) => {
    const cl: Record<string, boolean> = {}
    for (const c of (r.m47_checklist ?? []) as any[]) {
      cl[c.item_id as string] = c.valor as boolean
    }
    return {
      numero: idx + 1,
      puesto: r.puesto ?? null,
      nombre: r.nombre,
      direccion: r.direccion ?? null,
      telefono_casa: r.telefono_casa ?? null,
      celular: r.celular ?? null,
      fecha_nacimiento: r.fecha_nacimiento ?? null,
      emergencia_nombre: r.emergencia_nombre ?? null,
      emergencia_parentesco: r.emergencia_parentesco ?? null,
      emergencia_telefono: r.emergencia_telefono ?? null,
      observaciones: r.observaciones ?? null,
      checklist: cl,
    }
  })

  return { orgNombre, ranchoNombre, documentos, capacitaciones, trabajadores }
}

export async function generarRegistroPersonalPDF(
  ranchoId: string,
  orgId: string,
  codigoClave: string,
): Promise<void> {
  if (!ranchoId) throw new Error('Selecciona una instalacion')
  const { orgNombre, ranchoNombre, documentos, capacitaciones, trabajadores } =
    await cargarDatos(ranchoId, orgId)
  if (!trabajadores.length) throw new Error('Sin trabajadores en esta instalacion')
  const fecha = hoyMX()
  const blob = await pdf(
    <RegistroPersonalPDF
      orgNombre={orgNombre}
      rancho={ranchoNombre}
      fechaPDF={fecha}
      trabajadores={trabajadores}
      documentos={documentos}
      capacitaciones={capacitaciones}
      codigoClave={codigoClave}
    />
  ).toBlob()
  descargar(blob, nombrePdf('Registro_Personal', fecha, ranchoNombre))
}
