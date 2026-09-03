// PDF M44 — Orden de Mantenimiento (Cuarto Frio)
// Formato F-FRUS-MTT-01. A4 portrait. Helvetica. Plantilla homogénea M.A.D.Y.
// No Unicode: checkboxes (X) / espacio. Dos firmas en blanco.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type PrioridadM44PDF = 'inmediata' | 'turno' | 'siguientes_dias'

export interface OrdenMantenimientoPDFProps {
  organizacion: string
  instalacion: string
  instalacionCodigo: string
  fecha: string
  folio: string | null
  descripcion_solicitud: string | null
  prioridad: PrioridadM44PDF
  solicita: string | null
  recibe_mtto: string | null
  equipo_produccion: boolean
  lavado_sanitizado: boolean
  observaciones: string | null
  entrega_mtto: string | null
  recibe: string | null
  codigoClave: string
  terminoSitio?: string
}

// ── Constantes ────────────────────────────────────────────────────────────────

const PRIORIDAD_LABELS: Record<string, string> = {
  inmediata:       'Atencion inmediata',
  turno:           'Atencion durante el turno',
  siguientes_dias: 'Atencion durante los siguientes dias',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

// ── Sub-componente checkbox de prioridad ──────────────────────────────────────

function PrioCheckbox({ seleccionada, label }: { seleccionada: boolean; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <View style={{
        width: 11, height: 11, borderWidth: 1, borderColor: PC.border,
        alignItems: 'center', justifyContent: 'center',
      }}>
        {seleccionada && (
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: PC.section }}>X</Text>
        )}
      </View>
      <Text style={{ fontSize: 9, color: PC.fieldValue }}>{label}</Text>
    </View>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function OrdenMantenimientoPDF({
  organizacion, instalacion, instalacionCodigo, fecha, folio,
  descripcion_solicitud, prioridad, solicita, recibe_mtto,
  equipo_produccion, lavado_sanitizado, observaciones,
  entrega_mtto, recibe, codigoClave, terminoSitio = 'Instalación',
}: OrdenMantenimientoPDFProps) {
  const emision   = new Date().toLocaleDateString('es-MX')
  const codigoFmt = codigoFormato('F-FRUS-MTT-01', codigoClave)

  return (
    <Document
      title={`Orden de Mantenimiento ${instalacion} ${fecha}`}
      author="M.A.D.Y"
      subject="Orden de Mantenimiento"
    >
      <Page
        size="A4"
        style={{ fontFamily: 'Helvetica', fontSize: 9, padding: 30, paddingBottom: 50, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M44" />
        <TopBar />

        <PdfHeader
          titulo="ORDEN DE MANTENIMIENTO"
          subtitulo={`Orden de mantenimiento | ${instalacion}`}
          codigoFormato={codigoFmt}
          folio={folio ?? '—'}
          fecha={emision}
        />

        {/* Sección 1 — Datos generales */}
        <PdfSectionBanner>Datos generales</PdfSectionBanner>
        <PdfFieldGrid>
          <PdfFieldRow>
            <PdfField label="Organización" value={organizacion || '—'} />
            <PdfField label={terminoSitio} value={instalacion || '—'} />
            <PdfField label="Código" value={instalacionCodigo || '—'} />
            <PdfField label="Fecha" value={formatFecha(fecha)} />
            <PdfField label="Folio" value={folio ?? '—'} />
          </PdfFieldRow>
        </PdfFieldGrid>

        {/* Sección 2 — Descripción de la solicitud */}
        <PdfSectionBanner>Descripción de la solicitud</PdfSectionBanner>
        <View style={{
          borderLeftWidth: 1, borderLeftColor: PC.border,
          borderRightWidth: 1, borderRightColor: PC.border,
          borderBottomWidth: 1, borderBottomColor: PC.border,
          padding: 6, minHeight: 60, marginBottom: 2,
        }}>
          <Text style={{ fontSize: 9, color: PC.fieldValue, lineHeight: 1.4 }}>
            {descripcion_solicitud ?? ''}
          </Text>
        </View>

        {/* Sección 3 — Prioridad */}
        <PdfSectionBanner>Prioridad</PdfSectionBanner>
        <View style={{
          borderLeftWidth: 1, borderLeftColor: PC.border,
          borderRightWidth: 1, borderRightColor: PC.border,
          borderBottomWidth: 1, borderBottomColor: PC.border,
          padding: 8, marginBottom: 2,
        }}>
          {Object.entries(PRIORIDAD_LABELS).map(([id, label]) => (
            <PrioCheckbox key={id} seleccionada={prioridad === id} label={label} />
          ))}
        </View>

        {/* Sección 4 — Personal */}
        <PdfSectionBanner>Personal</PdfSectionBanner>
        <PdfFieldGrid>
          <PdfFieldRow>
            <PdfField label="Solicita" value={solicita || '—'} />
            <PdfField label="Recibe en Mantenimiento" value={recibe_mtto || '—'} />
          </PdfFieldRow>
        </PdfFieldGrid>

        {/* Sección 5 — Condiciones de entrega */}
        <PdfSectionBanner>Condiciones de entrega</PdfSectionBanner>
        <View style={{
          borderLeftWidth: 1, borderLeftColor: PC.border,
          borderRightWidth: 1, borderRightColor: PC.border,
          borderBottomWidth: 1, borderBottomColor: PC.border,
          padding: 8, marginBottom: 2,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ flex: 1, fontSize: 9, color: PC.fieldValue }}>{'¿Se reparo un equipo de produccion?'}</Text>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', width: 30, textAlign: 'right', color: equipo_produccion ? PC.section : PC.textSub }}>
              {equipo_produccion ? 'Si' : 'No'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 9, color: PC.fieldValue }}>{'¿El equipo fue lavado y sanitizado despues de la reparacion?'}</Text>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', width: 30, textAlign: 'right', color: lavado_sanitizado ? PC.section : PC.textSub }}>
              {lavado_sanitizado ? 'Si' : 'No'}
            </Text>
          </View>
        </View>

        {/* Sección 6 — Observaciones (condicional) */}
        {observaciones ? (
          <>
            <PdfSectionBanner>Observaciones</PdfSectionBanner>
            <View style={{
              borderLeftWidth: 1, borderLeftColor: PC.border,
              borderRightWidth: 1, borderRightColor: PC.border,
              borderBottomWidth: 1, borderBottomColor: PC.border,
              padding: 6, minHeight: 40, marginBottom: 2,
            }}>
              <Text style={{ fontSize: 9, color: PC.fieldValue, lineHeight: 1.4 }}>{observaciones}</Text>
            </View>
          </>
        ) : null}

        {/* Firmas */}
        <PdfSignatures
          signatures={[
            { label: entrega_mtto ?? '', nombre: '', caption: 'Entrega en Mantenimiento' },
            { label: recibe ?? '', nombre: '', caption: 'Recibe' },
          ]}
        />
      </Page>
    </Document>
  )
}
