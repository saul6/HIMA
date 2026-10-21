// PDF M77 — Identificación de empleados GlobalGAP, REG-ASIP-26 (diseño nuevo: lib/pdf/disenoNuevo).
import { Document, Text, View } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion, fechaEmisionHoy } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, ANCHO_UTIL, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'

export interface EmpleadoGGFilaPDF {
  id: string
  rancho: string
  nombre: string
  fecha_ingreso: string | null
  telefono: string | null
  domicilio: string | null
  persona_contacto: string | null
  observaciones: string | null
}

export interface EmpleadosGGPDFProps {
  rancho: string
  orgNombre?: string | null
  empleados: EmpleadoGGFilaPDF[]
  firmaRealizo?: FirmaParaPdf | null
}

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const COL = {
  nombre: 130,
  fecha: 65,
  telefono: 70,
  domicilio: 110,
  contacto: 100,
  observaciones: 90,
  firma: 80,
}

function formatFecha(iso: string | null): string {
  if (!iso) return '—'
  try { return fechaPdf(iso, { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return iso }
}

const COLS: ColumnaDato[] = [
  { texto: 'Nombre', ancho: COL.nombre },
  { texto: 'Fecha Ingreso', ancho: COL.fecha, align: 'center' },
  { texto: 'Teléfono', ancho: COL.telefono, align: 'center' },
  { texto: 'Domicilio', ancho: COL.domicilio },
  { texto: 'Contacto de emergencia', ancho: COL.contacto },
  { texto: 'Observaciones', ancho: COL.observaciones },
  { texto: 'Firma', ancho: COL.firma },
]

export function EmpleadosGGPagina({ rancho, orgNombre, empleados, firmaRealizo }: EmpleadosGGPDFProps) {
  return (
    <PaginaEstandar
      orientacion="portrait"
      titulo="IDENTIFICACIÓN DE EMPLEADOS"
      subtitulo={`REG-ASIP-26 · GlobalGAP | ${rancho}`}
      codigoFmt="REG-ASIP-26"
      folio=""
      emision={fechaEmisionHoy()}
      sinFolio
      camposDatos={orgNombre ? [{ icono: 'usuario', etiqueta: 'Empresa', valor: orgNombre }] : []}
    >
      <Seccion titulo={`LISTADO DE EMPLEADOS — ${rancho}`.toUpperCase()}>
        <TablaDatos
          columnas={COLS}
          anchoTotal={ANCHO_UTIL.portrait}
          vacio="Sin empleados registrados"
          filas={empleados.map((emp) => [
            { texto: emp.nombre, negrita: true },
            formatFecha(emp.fecha_ingreso),
            emp.telefono ?? '',
            emp.domicilio ?? '',
            emp.persona_contacto ?? '',
            emp.observaciones ?? '',
            // Celda en blanco para la firma física de cada empleado
            { nodo: <View style={{ height: 20 }} /> },
          ])}
        />
      </Seccion>

      <Text style={{ fontSize: 6.5, color: PC.textSub, fontFamily: 'Helvetica-Oblique', marginBottom: 8 }}>
        La columna "Firma" debe ser firmada de manera física por cada empleado al momento de leer y aceptar las políticas de la empresa.
      </Text>

      {firmaRealizo && (
        <PdfFirmas signatures={[{ label: '', nombre: '', caption: 'Nombre y firma del responsable', firma: firmaRealizo }]} />
      )}
    </PaginaEstandar>
  )
}

export function EmpleadosGGPDF(props: EmpleadosGGPDFProps) {
  return (
    <Document>
      <EmpleadosGGPagina {...props} />
    </Document>
  )
}

export function EmpleadosGGConsolidadoPDF({ empleados, orgNombre }: {
  empleados: EmpleadoGGFilaPDF[]
  orgNombre?: string | null
}) {
  const ranchoMap = new Map<string, EmpleadoGGFilaPDF[]>()
  for (const emp of empleados) {
    if (!ranchoMap.has(emp.rancho)) ranchoMap.set(emp.rancho, [])
    ranchoMap.get(emp.rancho)!.push(emp)
  }
  return (
    <Document>
      {[...ranchoMap.entries()].map(([rancho, emps]) => (
        <EmpleadosGGPagina
          key={rancho}
          rancho={rancho}
          orgNombre={orgNombre}
          empleados={emps}
        />
      ))}
    </Document>
  )
}
