// PATRÓN INOCUIDAD — PDF M12 (plantilla homogénea M.A.D.Y)
// LimpiezaBanosPagina: una página A4 portrait por jornada (reutilizable).
// LimpiezaBanosPDF:    documento individual (1 jornada).
// LimpiezaBanosConsolidadoPDF: documento multi-página, uno por jornada.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface LimpiezaBanoPDFRow {
  bano_numero: string
  limpieza: boolean
  desinfeccion: boolean
  concentracion_ppm: number
  sustancias: string[]
  abasto_papel: boolean
  succion: boolean
}

export interface LimpiezaBanosPaginaProps {
  rancho: string
  ranchoCodigo: string
  fecha: string       // "2026-06-15" ISO
  banos: LimpiezaBanoPDFRow[]
  terminoSitio?: string
}

export interface LimpiezaBanosConsolidadoPDFProps {
  jornadas: LimpiezaBanosPaginaProps[]
  ranchoNombre: string
  desde: string
  hasta: string
}

// ── Constantes de celda ───────────────────────────────────────────────────────

const ROW_ALT = '#F5F9FE'
const SI_BG   = '#E3F2FD'
const SI_TEXT = '#0D5A8F'
const NO_BG   = '#FAECE7'
const NO_TEXT = '#993C1D'

const thStyle = { padding: 3, borderRightWidth: 1, borderRightColor: '#5599CC', borderBottomWidth: 1, borderBottomColor: '#5599CC', justifyContent: 'center', alignItems: 'center' } as const
const tdStyle = { borderRightWidth: 1, borderRightColor: PC.border, borderBottomWidth: 1, borderBottomColor: PC.border, justifyContent: 'center', alignItems: 'center', padding: 2 } as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFechaPDF(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch { return iso }
}

function siNo(val: boolean): string { return val ? 'Si' : 'No' }

// ── Componente de página ──────────────────────────────────────────────────────

export function LimpiezaBanosPagina({
  rancho, ranchoCodigo, fecha, banos, terminoSitio = 'Rancho',
}: LimpiezaBanosPaginaProps) {
  const emision = new Date().toLocaleDateString('es-MX')

  return (
    <Page
      size="A4"
      style={{ fontFamily: 'Helvetica', fontSize: 9, padding: 30, paddingBottom: 50, backgroundColor: PC.white }}
    >
      <PdfFooter moduloCodigo="M12" />
      <TopBar />

      <PdfHeader
        titulo="LIMPIEZA Y DESINFECCION DE BANOS"
        subtitulo={`Registro de limpieza | ${rancho}`}
        codigoFormato="M.A.D.Y-F-SC-SIG-041.14"
        folio={formatFechaPDF(fecha)}
        fecha={emision}
      />

      <PdfSectionBanner>1. Datos del {terminoSitio.toLowerCase()} y jornada</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          <PdfField label={terminoSitio} value={rancho || '—'} />
          <PdfField label="Código" value={ranchoCodigo || '—'} />
          <PdfField label="Fecha" value={formatFechaPDF(fecha)} />
          <PdfField label="Total baños" value={String(banos.length)} />
        </PdfFieldRow>
      </PdfFieldGrid>

      <PdfSectionBanner>2. Registro de limpieza por baño</PdfSectionBanner>

      {/* Tabla de baños */}
      <View style={{ borderLeftWidth: 1, borderLeftColor: PC.border, borderTopWidth: 1, borderTopColor: PC.border, marginTop: 4, marginBottom: 8 }}>
        {/* Encabezado */}
        <View style={{ flexDirection: 'row' }}>
          <View style={[thStyle, { width: 45, backgroundColor: PC.section }]}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white, textAlign: 'center' }}>N.{'°'} Bano</Text>
          </View>
          <View style={[thStyle, { flex: 2, backgroundColor: PC.section }]}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white, textAlign: 'center' }}>Limpieza{'\n'}(Lavar y tallar)</Text>
          </View>
          <View style={[thStyle, { flex: 2, backgroundColor: PC.section }]}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white, textAlign: 'center' }}>Desinfeccion{'\n'}(3 ml cloro/L)</Text>
          </View>
          <View style={[thStyle, { width: 55, backgroundColor: PC.section }]}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white, textAlign: 'center' }}>Conc.{'\n'}(ppm)</Text>
          </View>
          <View style={[thStyle, { flex: 3, backgroundColor: PC.section }]}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white, textAlign: 'center' }}>Sustancias utilizadas</Text>
          </View>
          <View style={[thStyle, { flex: 2, backgroundColor: PC.section }]}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white, textAlign: 'center' }}>Abasto{'\n'}Papel</Text>
          </View>
          <View style={[thStyle, { flex: 1.5, backgroundColor: PC.section }]}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: PC.white, textAlign: 'center' }}>Succion</Text>
          </View>
        </View>

        {/* Filas de datos */}
        {banos.map((b, i) => {
          const bg = i % 2 === 1 ? ROW_ALT : PC.white
          return (
            <View key={i} style={{ flexDirection: 'row', backgroundColor: bg }}>
              <View style={[tdStyle, { width: 45, backgroundColor: bg }]}>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: PC.fieldValue }}>{b.bano_numero}</Text>
              </View>
              <View style={[tdStyle, { flex: 2, backgroundColor: b.limpieza ? SI_BG : NO_BG }]}>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: b.limpieza ? SI_TEXT : NO_TEXT }}>{siNo(b.limpieza)}</Text>
              </View>
              <View style={[tdStyle, { flex: 2, backgroundColor: b.desinfeccion ? SI_BG : NO_BG }]}>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: b.desinfeccion ? SI_TEXT : NO_TEXT }}>{siNo(b.desinfeccion)}</Text>
              </View>
              <View style={[tdStyle, { width: 55, backgroundColor: bg }]}>
                <Text style={{ fontSize: 8, textAlign: 'center', color: PC.fieldValue }}>{b.concentracion_ppm}</Text>
              </View>
              <View style={[tdStyle, { flex: 3, backgroundColor: bg, alignItems: 'flex-start', padding: 3 }]}>
                <Text style={{ fontSize: 7, color: PC.fieldValue }}>{b.sustancias.length > 0 ? b.sustancias.join(', ') : '—'}</Text>
              </View>
              <View style={[tdStyle, { flex: 2, backgroundColor: b.abasto_papel ? SI_BG : NO_BG }]}>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: b.abasto_papel ? SI_TEXT : NO_TEXT }}>{siNo(b.abasto_papel)}</Text>
              </View>
              <View style={[tdStyle, { flex: 1.5, backgroundColor: b.succion ? SI_BG : NO_BG }]}>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: b.succion ? SI_TEXT : NO_TEXT }}>{siNo(b.succion)}</Text>
              </View>
            </View>
          )
        })}
      </View>

      <PdfSectionBanner>3. Firmas y responsables</PdfSectionBanner>
      <PdfSignatures
        signatures={[
          { label: '', nombre: '', caption: 'Realizo la limpieza' },
          { label: '', nombre: '', caption: 'Responsable de Inocuidad — Firma' },
        ]}
      />
    </Page>
  )
}

// ── PDF individual ─────────────────────────────────────────────────────────────

export function LimpiezaBanosPDF(props: LimpiezaBanosPaginaProps) {
  return (
    <Document
      title={`Limpieza de Banos ${props.rancho} ${props.fecha}`}
      author="M.A.D.Y"
      subject="Limpieza y Desinfeccion de Banos"
    >
      <LimpiezaBanosPagina {...props} />
    </Document>
  )
}

// ── PDF consolidado ────────────────────────────────────────────────────────────

export function LimpiezaBanosConsolidadoPDF({
  jornadas, ranchoNombre, desde, hasta,
}: LimpiezaBanosConsolidadoPDFProps) {
  return (
    <Document
      title={`Limpieza Banos Consolidado ${ranchoNombre} ${desde} ${hasta}`}
      author="M.A.D.Y"
      subject="Limpieza y Desinfeccion de Banos Consolidado"
    >
      {jornadas.map((j, i) => (
        <LimpiezaBanosPagina key={i} {...j} />
      ))}
    </Document>
  )
}
