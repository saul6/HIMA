// PATRÓN INOCUIDAD — PDF M47 (plantilla homogénea M.A.D.Y)
// Registro de Personal — A4 landscape, tabla compleja de trabajadores.
// TopBar + PdfHeader + PdfSectionBanner + tabla 3-grupos + PdfLegend + PdfFooter.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PdfLegend } from '@/lib/pdf/components/PdfLegend'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface M47ItemPDF {
  id: string
  nombre: string
}

export interface M47TrabajadorPDF {
  numero: number
  puesto: string | null
  nombre: string
  direccion: string | null
  telefono_casa: string | null
  celular: string | null
  fecha_nacimiento: string | null
  emergencia_nombre: string | null
  emergencia_parentesco: string | null
  emergencia_telefono: string | null
  observaciones: string | null
  checklist: Record<string, boolean>
}

export interface RegistroPersonalPDFProps {
  orgNombre: string
  rancho: string
  fechaPDF: string
  trabajadores: M47TrabajadorPDF[]
  documentos: M47ItemPDF[]
  capacitaciones: M47ItemPDF[]
  codigoClave: string
  terminoSitio?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const t = (v: string | null | undefined): string => v ?? '—'

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  try {
    const [, m, d] = iso.split('-')
    const y = iso.slice(0, 4)
    return `${d}/${m}/${y}`
  } catch { return iso }
}

function fmtFechaCorta(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

// ── Anchos de columna ─────────────────────────────────────────────────────────

const COL_NO     = 16
const COL_PUESTO = 42
const COL_NOMBRE = 78
const COL_DIR    = 60
const COL_TCASA  = 36
const COL_CEL    = 36
const COL_FNAC   = 42
const COL_EM_NOM = 58
const COL_EM_PAR = 36
const COL_EM_TEL = 36
const COL_ITEM   = 20

// ── Constantes de estilo ──────────────────────────────────────────────────────

const ROW_ALT     = '#F5F9FE'
const GROUP_HDR_BG = '#EFF7F9'

// ── Estilos de celda inline ───────────────────────────────────────────────────

const thStyle = { padding: 3, borderRightWidth: 1, borderRightColor: '#5599CC', borderBottomWidth: 1, borderBottomColor: '#5599CC', justifyContent: 'center', alignItems: 'center' } as const
const tdStyle = { borderRightWidth: 1, borderRightColor: PC.border, borderBottomWidth: 1, borderBottomColor: PC.border, padding: 3 } as const

// ── RegistroPersonalPDF ───────────────────────────────────────────────────────

export function RegistroPersonalPDF({
  orgNombre, rancho, fechaPDF, trabajadores, documentos, capacitaciones,
  codigoClave, terminoSitio = 'Instalación',
}: RegistroPersonalPDFProps) {
  const emision   = new Date().toLocaleDateString('es-MX')
  const codigoFmt = codigoFormato('F-FRUS-ADM-04', codigoClave)

  const nDocs = documentos.length
  const nCaps = capacitaciones.length

  const wDocs     = nDocs * COL_ITEM
  const wCaps     = nCaps * COL_ITEM
  const fixedTotal = COL_NO + COL_PUESTO + COL_NOMBRE + COL_DIR + COL_TCASA + COL_CEL + COL_FNAC
    + COL_EM_NOM + COL_EM_PAR + COL_EM_TEL + wDocs + wCaps
  const COL_OBS   = Math.max(40, 801 - fixedTotal)

  // Leyenda para PdfLegend
  const legendEntradas = []
  if (nDocs > 0) {
    legendEntradas.push({
      titulo: 'Documentacion',
      items: documentos.map((d, i) => ({ codigo: `D${i + 1}`, label: d.nombre })),
    })
  }
  if (nCaps > 0) {
    legendEntradas.push({
      titulo: 'Capacitaciones',
      items: capacitaciones.map((c, i) => ({ codigo: `C${i + 1}`, label: c.nombre })),
    })
  }

  return (
    <Document
      title={`Registro de Personal — ${rancho} ${fmtFechaCorta(fechaPDF)}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
    >
      <Page
        size="A4"
        orientation="landscape"
        style={{ fontFamily: 'Helvetica', fontSize: 6.5, padding: 20, paddingBottom: 50, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M47" />
        <TopBar />

        <PdfHeader
          titulo="REGISTRO DE PERSONAL"
          subtitulo={`Personal | ${rancho}`}
          codigoFormato={codigoFmt}
          folio={fmtFechaCorta(fechaPDF)}
          fecha={emision}
        />

        <PdfSectionBanner>1. Datos del sitio</PdfSectionBanner>
        <PdfFieldGrid>
          <PdfFieldRow>
            <PdfField label={terminoSitio} value={rancho} />
            <PdfField label="Organizacion" value={orgNombre} />
            <PdfField label="Fecha" value={fmtFechaCorta(fechaPDF)} />
          </PdfFieldRow>
        </PdfFieldGrid>

        <PdfSectionBanner>2. Registro de trabajadores</PdfSectionBanner>

        {/* Tabla compleja de trabajadores */}
        <View style={{ borderLeftWidth: 1, borderLeftColor: PC.border, borderTopWidth: 1, borderTopColor: PC.border, marginTop: 4 }}>

          {/* Fila de grupo (encabezado de sección) */}
          <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
            <View style={[thStyle, { width: COL_NO, backgroundColor: PC.section, borderRightColor: '#5599CC' }]}>
              <Text style={{ fontSize: 5.5, color: PC.white }}> </Text>
            </View>
            <View style={[thStyle, { width: COL_PUESTO + COL_NOMBRE + COL_DIR + COL_TCASA + COL_CEL + COL_FNAC, backgroundColor: PC.section, borderRightColor: '#5599CC' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, color: PC.white, textAlign: 'center' }}>
                Datos personales del trabajador
              </Text>
            </View>
            <View style={[thStyle, { width: COL_EM_NOM + COL_EM_PAR + COL_EM_TEL, backgroundColor: PC.section, borderRightColor: '#5599CC' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, color: PC.white, textAlign: 'center' }}>
                Contacto de emergencia
              </Text>
            </View>
            {nDocs > 0 && (
              <View style={[thStyle, { width: wDocs, backgroundColor: PC.section, borderRightColor: '#5599CC' }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, color: PC.white, textAlign: 'center' }}>
                  Documentacion personal
                </Text>
              </View>
            )}
            {nCaps > 0 && (
              <View style={[thStyle, { width: wCaps, backgroundColor: PC.section, borderRightColor: '#5599CC' }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, color: PC.white, textAlign: 'center' }}>
                  Capacitaciones
                </Text>
              </View>
            )}
            <View style={[thStyle, { width: COL_OBS, backgroundColor: PC.section, borderRightWidth: 0 }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, color: PC.white, textAlign: 'center' }}>
                Observaciones
              </Text>
            </View>
          </View>

          {/* Fila de encabezado de columnas */}
          <View style={{ flexDirection: 'row', backgroundColor: GROUP_HDR_BG }}>
            <View style={[thStyle, { width: COL_NO, backgroundColor: GROUP_HDR_BG }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, color: PC.fieldValue }}>No.</Text>
            </View>
            <View style={[thStyle, { width: COL_PUESTO, backgroundColor: GROUP_HDR_BG }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, color: PC.fieldValue }}>Puesto</Text>
            </View>
            <View style={[thStyle, { width: COL_NOMBRE, backgroundColor: GROUP_HDR_BG }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, color: PC.fieldValue }}>Nombre</Text>
            </View>
            <View style={[thStyle, { width: COL_DIR, backgroundColor: GROUP_HDR_BG }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, color: PC.fieldValue }}>Direccion</Text>
            </View>
            <View style={[thStyle, { width: COL_TCASA, backgroundColor: GROUP_HDR_BG }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, color: PC.fieldValue }}>Tel. Casa</Text>
            </View>
            <View style={[thStyle, { width: COL_CEL, backgroundColor: GROUP_HDR_BG }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, color: PC.fieldValue }}>Celular</Text>
            </View>
            <View style={[thStyle, { width: COL_FNAC, backgroundColor: GROUP_HDR_BG }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, color: PC.fieldValue }}>F. Nac. D/M/A</Text>
            </View>
            <View style={[thStyle, { width: COL_EM_NOM, backgroundColor: GROUP_HDR_BG }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, color: PC.fieldValue }}>Nombre</Text>
            </View>
            <View style={[thStyle, { width: COL_EM_PAR, backgroundColor: GROUP_HDR_BG }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, color: PC.fieldValue }}>Parentesco</Text>
            </View>
            <View style={[thStyle, { width: COL_EM_TEL, backgroundColor: GROUP_HDR_BG }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, color: PC.fieldValue }}>Telefono</Text>
            </View>
            {documentos.map((d, i) => (
              <View key={d.id} style={[thStyle, { width: COL_ITEM, backgroundColor: GROUP_HDR_BG }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, color: PC.fieldValue, textAlign: 'center' }}>
                  {`D${i + 1}`}
                </Text>
              </View>
            ))}
            {capacitaciones.map((c, i) => (
              <View key={c.id} style={[thStyle, { width: COL_ITEM, backgroundColor: GROUP_HDR_BG }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, color: PC.fieldValue, textAlign: 'center' }}>
                  {`C${i + 1}`}
                </Text>
              </View>
            ))}
            <View style={[thStyle, { width: COL_OBS, backgroundColor: GROUP_HDR_BG, borderRightWidth: 0 }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 5.5, color: PC.fieldValue }}>Observaciones</Text>
            </View>
          </View>

          {/* Filas de datos */}
          {trabajadores.map((w, idx) => {
            const bg = idx % 2 === 1 ? ROW_ALT : PC.white
            return (
              <View key={idx} style={{ flexDirection: 'row', backgroundColor: bg }}>
                <View style={[tdStyle, { width: COL_NO, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue, textAlign: 'center' }}>{w.numero}</Text>
                </View>
                <View style={[tdStyle, { width: COL_PUESTO, backgroundColor: bg, justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{t(w.puesto)}</Text>
                </View>
                <View style={[tdStyle, { width: COL_NOMBRE, backgroundColor: bg, justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue, fontFamily: 'Helvetica-Bold' }}>{w.nombre}</Text>
                </View>
                <View style={[tdStyle, { width: COL_DIR, backgroundColor: bg, justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{t(w.direccion)}</Text>
                </View>
                <View style={[tdStyle, { width: COL_TCASA, backgroundColor: bg, justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{t(w.telefono_casa)}</Text>
                </View>
                <View style={[tdStyle, { width: COL_CEL, backgroundColor: bg, justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{t(w.celular)}</Text>
                </View>
                <View style={[tdStyle, { width: COL_FNAC, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue, textAlign: 'center' }}>{fmtFecha(w.fecha_nacimiento)}</Text>
                </View>
                <View style={[tdStyle, { width: COL_EM_NOM, backgroundColor: bg, justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{t(w.emergencia_nombre)}</Text>
                </View>
                <View style={[tdStyle, { width: COL_EM_PAR, backgroundColor: bg, justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{t(w.emergencia_parentesco)}</Text>
                </View>
                <View style={[tdStyle, { width: COL_EM_TEL, backgroundColor: bg, justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{t(w.emergencia_telefono)}</Text>
                </View>
                {documentos.map((d) => (
                  <View key={d.id} style={[tdStyle, { width: COL_ITEM, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 6, color: PC.fieldValue, textAlign: 'center' }}>
                      {w.checklist[d.id] ? 'Si' : ''}
                    </Text>
                  </View>
                ))}
                {capacitaciones.map((c) => (
                  <View key={c.id} style={[tdStyle, { width: COL_ITEM, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 6, color: PC.fieldValue, textAlign: 'center' }}>
                      {w.checklist[c.id] ? 'Si' : ''}
                    </Text>
                  </View>
                ))}
                <View style={[tdStyle, { width: COL_OBS, backgroundColor: bg, justifyContent: 'center', borderRightWidth: 0 }]}>
                  <Text style={{ fontSize: 6, color: PC.fieldValue }}>{t(w.observaciones)}</Text>
                </View>
              </View>
            )
          })}
        </View>

        {/* Leyenda D1..Dn + C1..Cn */}
        {legendEntradas.length > 0 && (
          <PdfLegend entradas={legendEntradas} />
        )}

        <PdfSectionBanner>3. Firmas y responsables</PdfSectionBanner>
        <PdfSignatures
          signatures={[
            { label: '', nombre: '', caption: 'Responsable de Recursos Humanos' },
            { label: '', nombre: '', caption: 'Jefe de la instalacion' },
          ]}
        />
      </Page>
    </Document>
  )
}
