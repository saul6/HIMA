// PDF M20 — Registro de Accidentes Laborales (Cuarto Frio)
// Formato F-FRUS-CAL-15 Rev 01. A4 portrait. Helvetica. Plantilla homogénea M.A.D.Y.
// No Unicode: checklist (X) / ( ). Dos firmas en blanco.

import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

// ── Constantes ────────────────────────────────────────────────────────────────

export const ATENCIONES_OPCIONES = [
  'Ninguna',
  'Curacion',
  'Primeros auxilios',
  'Atencion de paramedicos',
  'Atencion medica',
  'Hospitalizacion',
]

const SI_BG   = '#E3F2FD'
const SI_TEXT = '#0D5A8F'
const NO_BG   = '#FAECE7'
const NO_TEXT = '#993C1D'
const FOTO_COL = 2

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AccidenteLaboralPaginaProps {
  folio: string
  instalacion: string
  instalacionCodigo: string
  fecha: string                   // YYYY-MM-DD
  trabajadorNombre: string
  descripcionIncidente: string
  atencionRecibida: string[]      // etiquetas como vienen del DB (con acentos)
  requirioIncapacidad: boolean
  incapacidadMotivo: string | null
  codigoClave: string
  requirioLimpieza: boolean
  limpiezaDescripcion: string | null
  productoInvolucrado: boolean
  disposicionProducto: string | null
  dataUris: string[]              // data URIs base64, puede ser vacío
  terminoSitio?: string
}

export interface AccidenteLaboralConsolidadoPDFProps {
  registros: AccidenteLaboralPaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFechaPDF(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch { return iso }
}

// Normaliza la cadena para comparar sin acentos/tildes
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function estaSeleccionada(opcion: string, seleccionadas: string[]): boolean {
  const n = normalizar(opcion)
  return seleccionadas.some((s) => normalizar(s) === n)
}

// ── Componente de página ──────────────────────────────────────────────────────

export function AccidenteLaboralPagina({
  folio,
  instalacion,
  instalacionCodigo,
  fecha,
  trabajadorNombre,
  descripcionIncidente,
  atencionRecibida,
  requirioIncapacidad,
  incapacidadMotivo,
  codigoClave,
  requirioLimpieza,
  limpiezaDescripcion,
  productoInvolucrado,
  disposicionProducto,
  dataUris,
  terminoSitio = 'Instalación',
}: AccidenteLaboralPaginaProps) {
  const emision   = new Date().toLocaleDateString('es-MX')
  const codigoFmt = codigoFormato('F-FRUS-CAL-15', codigoClave)

  return (
    <Page
      size="A4"
      style={{ fontFamily: 'Helvetica', fontSize: 9, padding: 30, paddingBottom: 50, backgroundColor: PC.white }}
    >
      <PdfFooter moduloCodigo="M20" />
      <TopBar />

      <PdfHeader
        titulo="REGISTRO DE ACCIDENTES LABORALES"
        subtitulo={`Accidente laboral | ${instalacion} | ${formatFechaPDF(fecha)}`}
        codigoFormato={codigoFmt}
        folio={folio}
        fecha={emision}
      />

      {/* Sección 1 — Datos generales */}
      <PdfSectionBanner>1. Datos generales</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          <PdfField label={terminoSitio} value={instalacion || '—'} />
          <PdfField label="Código" value={instalacionCodigo || '—'} />
          <PdfField label="Fecha del accidente" value={formatFechaPDF(fecha)} />
        </PdfFieldRow>
        <PdfFieldRow>
          <PdfField label="Nombre del trabajador" value={trabajadorNombre || '—'} fullWidth />
        </PdfFieldRow>
      </PdfFieldGrid>

      {/* Sección 2 — Descripción del incidente */}
      <PdfSectionBanner>2. Descripción del incidente</PdfSectionBanner>
      <View style={{
        borderLeftWidth: 1, borderLeftColor: PC.border,
        borderRightWidth: 1, borderRightColor: PC.border,
        borderBottomWidth: 1, borderBottomColor: PC.border,
        padding: 6, minHeight: 48, marginBottom: 2,
      }}>
        <Text style={{ fontSize: 9, color: PC.fieldValue, lineHeight: 1.45 }}>
          {descripcionIncidente || '—'}
        </Text>
      </View>

      {/* Sección 3 — Atención recibida */}
      <PdfSectionBanner>3. Atención recibida</PdfSectionBanner>
      <View style={{
        borderLeftWidth: 1, borderLeftColor: PC.border,
        borderRightWidth: 1, borderRightColor: PC.border,
        borderBottomWidth: 1, borderBottomColor: PC.border,
        padding: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 2,
      }}>
        {ATENCIONES_OPCIONES.map((op) => {
          const sel = estaSeleccionada(op, atencionRecibida)
          return (
            <View key={op} style={{ width: '47%', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: PC.fieldValue, width: 14 }}>
                {sel ? '(X)' : '( )'}
              </Text>
              <Text style={{ fontSize: 9, color: PC.fieldValue }}>{op}</Text>
            </View>
          )
        })}
      </View>

      {/* Sección 4 — Requirió incapacidad */}
      <PdfSectionBanner>4. Requirió incapacidad</PdfSectionBanner>
      <View style={{
        flexDirection: 'row',
        borderLeftWidth: 1, borderLeftColor: PC.border,
        borderRightWidth: 1, borderRightColor: PC.border,
        borderBottomWidth: 1, borderBottomColor: PC.border,
        marginBottom: 2,
      }}>
        <View style={{
          paddingTop: 5, paddingBottom: 5, paddingLeft: 10, paddingRight: 10,
          fontFamily: 'Helvetica-Bold', fontSize: 9,
          justifyContent: 'center', alignItems: 'center',
          borderRightWidth: 1, borderRightColor: PC.border,
          width: 40, textAlign: 'center',
          backgroundColor: requirioIncapacidad ? SI_BG : NO_BG,
        }}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: requirioIncapacidad ? SI_TEXT : NO_TEXT }}>
            {requirioIncapacidad ? 'Si' : 'No'}
          </Text>
        </View>
        <View style={{ flex: 1, padding: 5, minHeight: 28 }}>
          <Text style={{ fontSize: 9, color: PC.fieldValue }}>
            {requirioIncapacidad && incapacidadMotivo ? incapacidadMotivo : ''}
          </Text>
        </View>
      </View>

      {/* Sección 5 — Requirió limpieza del área */}
      <PdfSectionBanner>5. Requirió limpieza del área</PdfSectionBanner>
      <View style={{
        flexDirection: 'row',
        borderLeftWidth: 1, borderLeftColor: PC.border,
        borderRightWidth: 1, borderRightColor: PC.border,
        borderBottomWidth: 1, borderBottomColor: PC.border,
        marginBottom: 2,
      }}>
        <View style={{
          paddingTop: 5, paddingBottom: 5, paddingLeft: 10, paddingRight: 10,
          justifyContent: 'center', alignItems: 'center',
          borderRightWidth: 1, borderRightColor: PC.border,
          width: 40, textAlign: 'center',
          backgroundColor: requirioLimpieza ? SI_BG : NO_BG,
        }}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: requirioLimpieza ? SI_TEXT : NO_TEXT }}>
            {requirioLimpieza ? 'Si' : 'No'}
          </Text>
        </View>
        <View style={{ flex: 1, padding: 5, minHeight: 28 }}>
          <Text style={{ fontSize: 9, color: PC.fieldValue }}>
            {requirioLimpieza && limpiezaDescripcion ? limpiezaDescripcion : ''}
          </Text>
        </View>
      </View>

      {/* Sección 6 — Producto involucrado */}
      <PdfSectionBanner>6. Producto involucrado</PdfSectionBanner>
      <View style={{
        flexDirection: 'row',
        borderLeftWidth: 1, borderLeftColor: PC.border,
        borderRightWidth: 1, borderRightColor: PC.border,
        borderBottomWidth: 1, borderBottomColor: PC.border,
        marginBottom: 2,
      }}>
        <View style={{
          paddingTop: 5, paddingBottom: 5, paddingLeft: 10, paddingRight: 10,
          justifyContent: 'center', alignItems: 'center',
          borderRightWidth: 1, borderRightColor: PC.border,
          width: 40, textAlign: 'center',
          backgroundColor: productoInvolucrado ? SI_BG : NO_BG,
        }}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: productoInvolucrado ? SI_TEXT : NO_TEXT }}>
            {productoInvolucrado ? 'Si' : 'No'}
          </Text>
        </View>
        <View style={{ flex: 1, padding: 5, minHeight: 28 }}>
          <Text style={{ fontSize: 9, color: PC.fieldValue }}>
            {productoInvolucrado && disposicionProducto
              ? `Disposicion: ${disposicionProducto}`
              : ''}
          </Text>
        </View>
      </View>

      {/* Sección 7 — Evidencia fotográfica (opcional) */}
      {dataUris.length > 0 && (
        <>
          <PdfSectionBanner>7. Evidencia fotográfica</PdfSectionBanner>
          <View style={{
            flexDirection: 'row', flexWrap: 'wrap', gap: 6,
            borderLeftWidth: 1, borderLeftColor: PC.border,
            borderRightWidth: 1, borderRightColor: PC.border,
            borderBottomWidth: 1, borderBottomColor: PC.border,
            padding: 6, marginBottom: 2,
          }}>
            {dataUris.map((uri, i) => (
              <View key={i} style={{ width: `${Math.floor(100 / FOTO_COL) - 2}%`, height: 120 }}>
                {uri ? (
                  <Image src={uri} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <View style={{ width: '100%', height: '100%', backgroundColor: '#F0F0F0', borderWidth: 1, borderColor: PC.border }} />
                )}
              </View>
            ))}
          </View>
        </>
      )}

      {/* Firmas */}
      <PdfSignatures
        signatures={[
          { label: '', nombre: '', caption: 'Firma del Jefe de Seguridad' },
          { label: '', nombre: '', caption: 'Firma del Jefe del Cooler' },
        ]}
      />
    </Page>
  )
}

// ── PDF individual ─────────────────────────────────────────────────────────────

export function AccidenteLaboralPDF(props: AccidenteLaboralPaginaProps) {
  return (
    <Document
      title={`Accidente Laboral ${props.instalacion} ${props.fecha}`}
      author="M.A.D.Y"
      subject="Registro de Accidentes Laborales"
    >
      <AccidenteLaboralPagina {...props} />
    </Document>
  )
}

// ── PDF consolidado ────────────────────────────────────────────────────────────

export function AccidenteLaboralConsolidadoPDF({
  registros,
  instalacionNombre,
  desde,
  hasta,
}: AccidenteLaboralConsolidadoPDFProps) {
  return (
    <Document
      title={`Accidentes Laborales Consolidado ${instalacionNombre} ${desde} ${hasta}`}
      author="M.A.D.Y"
      subject="Registro de Accidentes Laborales Consolidado"
    >
      {registros.map((r, i) => (
        <AccidenteLaboralPagina key={i} {...r} />
      ))}
    </Document>
  )
}
