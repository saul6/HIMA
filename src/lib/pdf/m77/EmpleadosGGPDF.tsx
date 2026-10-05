import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

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

const MARGIN = 20

// Portrait A4, usable ≈ 555 pt
const COL = {
  nombre: 130,
  fecha: 65,
  telefono: 70,
  domicilio: 110,
  contacto: 100,
  firma: 80,
}
// Total: 130+65+70+110+100+80 = 555

function formatFecha(iso: string | null): string {
  if (!iso) return '—'
  try { return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return iso }
}

function HC({ w, children, right = true }: { w: number; children?: React.ReactNode; right?: boolean }) {
  return (
    <View style={{ width: w, minWidth: w, backgroundColor: PC.section, alignItems: 'center', justifyContent: 'center', borderRightWidth: right ? 1 : 0, borderRightColor: '#5599CC', padding: '3px 4px' }}>
      <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PC.white, textAlign: 'center' }}>{children ?? ''}</Text>
    </View>
  )
}

function TablaEmpleados({ empleados }: { empleados: EmpleadoGGFilaPDF[] }) {
  return (
    <View style={{ borderWidth: 1, borderColor: PC.border }}>
      <View style={{ flexDirection: 'row' }}>
        <HC w={COL.nombre}>Nombre</HC>
        <HC w={COL.fecha}>Fecha Ingreso</HC>
        <HC w={COL.telefono}>Telefono</HC>
        <HC w={COL.domicilio}>Domicilio</HC>
        <HC w={COL.contacto}>Contacto emergencia</HC>
        <HC w={COL.firma} right={false}>Firma</HC>
      </View>
      {empleados.map((emp, i) => {
        const bg = i % 2 === 0 ? PC.white : '#F5F9FE'
        const h = 24
        return (
          <View key={emp.id} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: PC.border, minHeight: h }}>
            <View style={{ width: COL.nombre, padding: '4px', backgroundColor: bg, borderRightWidth: 1, borderRightColor: PC.border }}>
              <Text style={{ fontSize: 7.5, color: PC.fieldValue, fontFamily: 'Helvetica-Bold' }}>{emp.nombre}</Text>
            </View>
            <View style={{ width: COL.fecha, padding: '4px', backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: PC.border }}>
              <Text style={{ fontSize: 7, color: PC.fieldValue, textAlign: 'center' }}>{formatFecha(emp.fecha_ingreso)}</Text>
            </View>
            <View style={{ width: COL.telefono, padding: '4px', backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: PC.border }}>
              <Text style={{ fontSize: 7, color: PC.fieldValue }}>{emp.telefono ?? ''}</Text>
            </View>
            <View style={{ width: COL.domicilio, padding: '4px', backgroundColor: bg, borderRightWidth: 1, borderRightColor: PC.border }}>
              <Text style={{ fontSize: 7, color: PC.fieldValue }}>{emp.domicilio ?? ''}</Text>
            </View>
            <View style={{ width: COL.contacto, padding: '4px', backgroundColor: bg, borderRightWidth: 1, borderRightColor: PC.border }}>
              <Text style={{ fontSize: 7, color: PC.fieldValue }}>{emp.persona_contacto ?? ''}</Text>
            </View>
            {/* Firma — blank for physical signature */}
            <View style={{ width: COL.firma, padding: '4px', backgroundColor: bg, minHeight: h }} />
          </View>
        )
      })}
      {empleados.length === 0 && (
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: PC.border }}>
          <View style={{ flex: 1, padding: '8px 4px', alignItems: 'center' }}>
            <Text style={{ fontSize: 7.5, color: PC.textSub, fontStyle: 'italic' }}>Sin empleados registrados</Text>
          </View>
        </View>
      )}
    </View>
  )
}

export function EmpleadosGGPagina({ rancho, orgNombre, empleados, firmaRealizo }: EmpleadosGGPDFProps) {
  return (
    <Page size="A4" style={{ fontFamily: 'Helvetica', fontSize: 8, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}>
      <PdfFooter moduloCodigo="REG-ASIP-26" />
      <TopBar />
      <PdfHeader
        titulo="IDENTIFICACION DE EMPLEADOS"
        subtitulo={`REG-ASIP-26 · GlobalGAP | ${rancho}`}
        codigoFormato="REG-ASIP-26"
        folio={rancho}
        fecha=""
      />

      {orgNombre && (
        <View style={{ paddingHorizontal: 4, marginBottom: 4 }}>
          <Text style={{ fontSize: 8, color: PC.textSub }}>Empresa: <Text style={{ color: PC.fieldValue, fontFamily: 'Helvetica-Bold' }}>{orgNombre}</Text></Text>
        </View>
      )}

      <PdfSectionBanner>Listado de empleados — {rancho}</PdfSectionBanner>
      <TablaEmpleados empleados={empleados} />

      <View style={{ marginTop: 6 }}>
        <Text style={{ fontSize: 6.5, color: PC.textSub, fontStyle: 'italic' }}>
          La columna "Firma" debe ser firmada de manera fisica por cada empleado al momento de leer y aceptar las politicas de la empresa.
        </Text>
      </View>

      {firmaRealizo && (
        <View style={{ marginTop: 20 }}>
          <View style={{ width: 160, alignItems: 'center' }}>
            {firmaRealizo.estado === 'vigente' && firmaRealizo.png && (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <></>
            )}
            <View style={{ borderTopWidth: 1, borderTopColor: PC.border, paddingTop: 4, width: '100%', alignItems: 'center' }}>
              <Text style={{ fontSize: 7, color: PC.textSub }}>Nombre y firma del responsable</Text>
            </View>
          </View>
        </View>
      )}
    </Page>
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
