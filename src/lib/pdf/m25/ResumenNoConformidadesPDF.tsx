// PATRÓN INOCUIDAD — PDF M25 (plantilla homogénea M.A.D.Y)
// Resumen de No-Conformidades — A4 portrait, multi-página.
// Encabezado fijo repetido (TopBar + logo + meta), PdfSectionBanner, PdfFooter.

import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { LOGO_MADY_PDF } from '@/lib/pdf/assets/logoMadyPdf'
import { PC } from '@/lib/pdf/components/tokens'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface NcrFila {
  ncr: number
  modulo: string
  codigo_pregunta: string
  seccion: string
  texto_pregunta: string
  comentario: string
}

export interface ResumenNoConformidadesPDFProps {
  orgNombre: string
  ranchoNombre: string
  fecha: string
  auditorNombre: string
  clienteNombre: string
  paPgfs: string | null
  ncrs: NcrFila[]
  notaPlazo?: string
  terminoSitio?: string
}

// ── Constantes ────────────────────────────────────────────────────────────────

const NOTE_DEFAULT =
  'Las no-conformidades deben atenderse en un maximo de 30 dias naturales a partir de la fecha de auditoria.'

const DANGER_FILL = '#FAECE7'
const DANGER_TEXT = '#993C1D'
const ROW_ALT     = '#F5F9FE'
const WARN_FILL   = '#FFFDE7'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFechaPDF(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch { return iso }
}

// ── Estilos de tabla ──────────────────────────────────────────────────────────

const thCell = {
  color: PC.white,
  fontFamily: 'Helvetica-Bold' as const,
  fontSize: 7,
  paddingTop: 5,
  paddingBottom: 5,
  paddingLeft: 6,
  paddingRight: 6,
  borderRightWidth: 1,
  borderRightColor: '#5599CC',
  borderBottomWidth: 1,
  borderBottomColor: '#5599CC',
}

const tdCell = {
  fontSize: 8,
  paddingTop: 5,
  paddingBottom: 5,
  paddingLeft: 6,
  paddingRight: 6,
  borderRightWidth: 1,
  borderRightColor: PC.border,
  borderBottomWidth: 1,
  borderBottomColor: PC.border,
  color: PC.fieldValue,
}

const infoCell = {
  flex: 1,
  borderRightWidth: 1,
  borderRightColor: PC.border,
  borderBottomWidth: 1,
  borderBottomColor: PC.border,
  paddingTop: 5,
  paddingBottom: 5,
  paddingLeft: 8,
  paddingRight: 8,
}

// ── ResumenNoConformidadesPDF ─────────────────────────────────────────────────

export function ResumenNoConformidadesPDF({
  orgNombre,
  ranchoNombre,
  fecha,
  auditorNombre,
  clienteNombre,
  paPgfs,
  ncrs,
  notaPlazo = NOTE_DEFAULT,
  terminoSitio = 'Instalación',
}: ResumenNoConformidadesPDFProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const fechaFormateada = formatFechaPDF(fecha)

  return (
    <Document
      title={`Resumen_No_Conformidades_${fecha}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Resumen de No-Conformidades PrimusGFS"
      keywords="MADY, inocuidad, no-conformidades, auditoria"
    >
      <Page
        size="A4"
        style={{
          fontFamily: 'Helvetica',
          fontSize: 9,
          color: PC.fieldValue,
          paddingTop: 82,
          paddingBottom: 55,
          paddingLeft: 50,
          paddingRight: 50,
          backgroundColor: PC.white,
        }}
      >
        {/* ── Encabezado fijo — se repite en cada página ── */}
        <View fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: PC.white }}>
          <TopBar />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 6, paddingBottom: 6, paddingLeft: 50, paddingRight: 50 }}>
            <View style={{ flex: 6 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: PC.titleNavy }}>
                RESUMEN DE NO-CONFORMIDADES
              </Text>
              <Text style={{ fontSize: 7, color: PC.textSub, marginTop: 2 }}>
                Acciones correctivas  ·  {terminoSitio}: {ranchoNombre}
              </Text>
            </View>
            <View style={{ flex: 4, alignItems: 'flex-end' }}>
              <Image src={LOGO_MADY_PDF} style={{ height: 36, width: 101 }} />
            </View>
          </View>
          <View style={{
            borderTopWidth: 1, borderTopColor: PC.border,
            flexDirection: 'row', gap: 20,
            paddingTop: 3, paddingBottom: 4, paddingLeft: 50, paddingRight: 50,
          }}>
            <Text style={{ fontSize: 7, color: PC.textSub }}>Emision: {emision}</Text>
            <Text style={{ fontSize: 7, color: PC.textSub }}>Fecha de auditoria: {fechaFormateada}</Text>
            <Text style={{ fontSize: 7, color: PC.textSub }}>Auditor: {auditorNombre || '—'}</Text>
            {paPgfs ? <Text style={{ fontSize: 7, color: PC.textSub }}>PA-PGFS: {paPgfs}</Text> : null}
          </View>
        </View>

        <PdfFooter moduloCodigo="M25" />

        {/* ── Sección 1: Información general ── */}
        <View style={{ backgroundColor: PC.section, borderRadius: 4, marginTop: 0, marginBottom: 0, paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10 }}>
          <Text style={{ color: PC.white, fontFamily: 'Helvetica-Bold', fontSize: 8 }}>
            1. INFORMACION GENERAL
          </Text>
        </View>
        <View style={{ borderLeftWidth: 1, borderLeftColor: PC.border, borderTopWidth: 1, borderTopColor: PC.border }}>
          <View style={{ flexDirection: 'row' }}>
            <View style={infoCell}>
              <Text style={{ fontSize: 6, color: PC.textSub, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>ORGANIZACION</Text>
              <Text style={{ fontSize: 9, color: PC.fieldValue }}>{orgNombre}</Text>
            </View>
            <View style={[infoCell, { borderRightWidth: 0 }]}>
              <Text style={{ fontSize: 6, color: PC.textSub, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>OPERACION / {terminoSitio.toUpperCase()}</Text>
              <Text style={{ fontSize: 9, color: PC.fieldValue }}>{ranchoNombre}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <View style={infoCell}>
              <Text style={{ fontSize: 6, color: PC.textSub, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>FECHA DE AUDITORIA</Text>
              <Text style={{ fontSize: 9, color: PC.fieldValue }}>{fechaFormateada}</Text>
            </View>
            <View style={[infoCell, { borderRightWidth: 0 }]}>
              <Text style={{ fontSize: 6, color: PC.textSub, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>AUDITOR</Text>
              <Text style={{ fontSize: 9, color: PC.fieldValue }}>{auditorNombre || '—'}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <View style={infoCell}>
              <Text style={{ fontSize: 6, color: PC.textSub, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>CLIENTE / REPRESENTANTE</Text>
              <Text style={{ fontSize: 9, color: PC.fieldValue }}>{clienteNombre || '—'}</Text>
            </View>
            <View style={[infoCell, { borderRightWidth: 0 }]}>
              <Text style={{ fontSize: 6, color: PC.textSub, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>TOTAL DE NO-CONFORMIDADES</Text>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: DANGER_TEXT }}>
                {ncrs.length} NCR{ncrs.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Sección 2: Tabla NCRs ── */}
        <View style={{ backgroundColor: PC.section, borderRadius: 4, marginTop: 10, marginBottom: 0, paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10 }}>
          <Text style={{ color: PC.white, fontFamily: 'Helvetica-Bold', fontSize: 8 }}>
            2. NO-CONFORMIDADES DETECTADAS
          </Text>
        </View>
        <View style={{ borderLeftWidth: 1, borderLeftColor: PC.border, borderTopWidth: 1, borderTopColor: PC.border }}>
          {/* Encabezado de columnas — se repite en cada página */}
          <View style={{ flexDirection: 'row', backgroundColor: PC.section }} fixed>
            <Text style={[thCell, { width: 42, textAlign: 'center' }]}>No.</Text>
            <Text style={[thCell, { flex: 2 }]}>Modulo / Seccion / Pregunta</Text>
            <Text style={[thCell, { flex: 2, borderRightWidth: 0 }]}>Descripcion de la no-conformidad</Text>
          </View>

          {ncrs.length === 0 ? (
            <View style={{ flexDirection: 'row' }}>
              <Text style={[tdCell, { flex: 1, textAlign: 'center', color: PC.textSub, borderRightWidth: 0 }]}>
                Sin no-conformidades en esta visita
              </Text>
            </View>
          ) : (
            ncrs.map((ncr, i) => (
              <View key={ncr.ncr} style={{ flexDirection: 'row', backgroundColor: i % 2 !== 0 ? ROW_ALT : PC.white }} wrap={false}>
                <Text style={[tdCell, { width: 42, textAlign: 'center', fontFamily: 'Helvetica-Bold',
                  color: DANGER_TEXT, backgroundColor: DANGER_FILL }]}>
                  NCR{ncr.ncr}
                </Text>
                <View style={[tdCell, { flex: 2 }]}>
                  <Text style={{ fontSize: 7, color: PC.textSub, fontFamily: 'Helvetica-Bold' }}>
                    {ncr.modulo.toUpperCase()} — {ncr.seccion}
                  </Text>
                  <Text style={{ fontSize: 7, color: PC.textSub, marginTop: 1 }}>{ncr.codigo_pregunta}</Text>
                  <Text style={{ marginTop: 2 }}>{ncr.texto_pregunta}</Text>
                </View>
                <View style={[tdCell, { flex: 2, borderRightWidth: 0 }]}>
                  <Text>{ncr.comentario || '—'}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Nota de plazo */}
        <View style={{
          marginTop: 10,
          borderWidth: 1, borderColor: '#E0C860',
          padding: 8,
          backgroundColor: WARN_FILL,
          borderRadius: 3,
        }}>
          <Text style={{ fontSize: 7, color: '#6D4C00' }}>Nota: {notaPlazo}</Text>
        </View>

        {/* ── Sección 3: Firmas ── */}
        <View style={{ backgroundColor: PC.section, borderRadius: 4, marginTop: 14, marginBottom: 0, paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10 }}>
          <Text style={{ color: PC.white, fontFamily: 'Helvetica-Bold', fontSize: 8 }}>
            3. FIRMAS
          </Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 24 }}>
          <View style={{ flex: 1, marginRight: 16 }}>
            <View style={{ borderTopWidth: 1, borderTopColor: PC.fieldValue, marginTop: 36, paddingTop: 4 }}>
              <Text style={{ fontSize: 7, color: PC.textSub }}>Firma del Cliente</Text>
              <Text style={{ fontSize: 7, color: PC.textSub, marginTop: 2 }}>{clienteNombre || ' '}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ borderTopWidth: 1, borderTopColor: PC.fieldValue, marginTop: 36, paddingTop: 4 }}>
              <Text style={{ fontSize: 7, color: PC.textSub }}>Firma del Auditor</Text>
              <Text style={{ fontSize: 7, color: PC.textSub, marginTop: 2 }}>{auditorNombre || ' '}</Text>
            </View>
          </View>
        </View>

      </Page>
    </Document>
  )
}
