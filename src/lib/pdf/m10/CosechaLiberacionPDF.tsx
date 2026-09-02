// PATRÓN INOCUIDAD — PDF M10 (plantilla homogénea M.A.D.Y)
// CosechaLiberacionPagina: una Page A4 landscape por jornada.
// CosechaLiberacionPDF:    documento individual.
// CosechaLiberacionConsolidadoPDF: documento multi-página.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfPageFrame, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface CosechaLiberacionFilaPDF {
  sector: string | null
  cantidad_bandejas: number | null
  lote_liberado: boolean
  numero_comprobante: string | null
  codigo_trazabilidad: string | null
  marca_embalaje: string | null
  destino_final: string | null
  fruta_proceso_kg: number | null
  encargado_nombre: string | null
  verificacion_semanal: boolean
  hora_inicio_cosecha: string | null
  hora_fin_cosecha: string | null
  observaciones: string | null
}

export interface CosechaLiberacionPaginaProps {
  rancho: string
  ranchoCodigo: string
  fecha: string
  liberaciones: CosechaLiberacionFilaPDF[]
  folio?: string
  codigoClave?: string
  terminoSitio?: string
}

export interface CosechaLiberacionConsolidadoPDFProps {
  registros: CosechaLiberacionPaginaProps[]
  ranchoNombre: string
  desde: string
  hasta: string
}

// col widths escalados de 781 → 764pt (content width con PdfPageFrame + padding 14)
// fecha(44) + sector(59) + bandejas(44) + loteLib(44) + comprobante(73) +
// trazabilidad(78) + marcaEmbalaje(64) + destino(68) + frutaKg(47) +
// encargado(81) + verif(44) + observaciones(118) = 764
const W = {
  fecha:         44,
  sector:        59,
  bandejas:      44,
  loteLib:       44,
  comprobante:   73,
  trazabilidad:  78,
  marcaEmbalaje: 64,
  destino:       68,
  frutaKg:       47,
  encargado:     81,
  verif:         44,
  observaciones: 118,
} as const

function formatFechaPDF(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch { return iso }
}

function siNo(val: boolean): string { return val ? 'Si' : 'No' }

function formatObservaciones(inicio: string | null, fin: string | null, obs: string | null): string {
  const partes: string[] = []
  if (inicio || fin) partes.push(`${inicio ?? '--:--'} - ${fin ?? '--:--'}`)
  if (obs) partes.push(obs)
  return partes.join('\n') || '—'
}

// Celda con fondo de color para Lote Liberado y Verificación Semanal
function CeldaSiNo({ width, valor }: { width: number; valor: boolean }) {
  const bg    = valor ? '#E3F2FD' : '#FAECE7'
  const color = valor ? '#0D5A8F' : '#993C1D'
  return (
    <View style={{
      width,
      borderRightWidth: 1, borderRightColor: PC.border,
      borderBottomWidth: 1, borderBottomColor: PC.border,
      paddingVertical: 4, paddingHorizontal: 3,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: bg,
    }}>
      <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color, textAlign: 'center' }}>
        {siNo(valor)}
      </Text>
    </View>
  )
}

// ── CosechaLiberacionPagina ───────────────────────────────────────────────────

export function CosechaLiberacionPagina({
  rancho, ranchoCodigo, fecha, liberaciones,
  folio, codigoClave = 'MXA', terminoSitio = 'Rancho',
}: CosechaLiberacionPaginaProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const codigoFmt = `${codigoClave}-F-SC-SIG`
  const folioDisplay = folio ?? fecha

  const hdrCell = {
    color: PC.white,
    fontFamily: 'Helvetica-Bold' as const,
    fontSize: 6,
    paddingVertical: 4,
    paddingHorizontal: 3,
    borderRightWidth: 1,
    borderRightColor: '#5599CC',
    borderBottomWidth: 1,
    borderBottomColor: '#5599CC',
    textAlign: 'center' as const,
  }
  const cell = {
    fontSize: 7,
    paddingVertical: 4,
    paddingHorizontal: 3,
    borderRightWidth: 1,
    borderRightColor: PC.border,
    borderBottomWidth: 1,
    borderBottomColor: PC.border,
    color: PC.fieldValue,
  }

  return (
    <Page
      size="A4"
      orientation="landscape"
      style={{ fontFamily: 'Helvetica', fontSize: 9, padding: 24, paddingBottom: 50, backgroundColor: PC.white }}
    >
      <PdfFooter moduloCodigo="M10" />

      <PdfPageFrame>
        <PdfHeader
          titulo="REGISTRO DE COSECHA Y LIBERACIÓN"
          subtitulo={`Formato operativo | ${rancho}`}
          codigoFormato={codigoFmt}
          folio={folioDisplay}
          fecha={emision}
        />

        <View style={{ padding: 14 }}>

          <PdfSectionBanner>1. Datos del sitio y jornada</PdfSectionBanner>
          <PdfFieldGrid>
            <PdfFieldRow>
              <PdfField label={terminoSitio} value={rancho} />
              <PdfField label="Código" value={ranchoCodigo || '—'} />
              <PdfField label="Fecha de registro" value={formatFechaPDF(fecha)} />
              <PdfField label="Total liberaciones" value={String(liberaciones.length)} />
            </PdfFieldRow>
          </PdfFieldGrid>

          <PdfSectionBanner>2. Registro de liberaciones</PdfSectionBanner>

          {/* Tabla de liberaciones */}
          <View style={{
            borderLeftWidth: 1, borderLeftColor: PC.border,
            borderTopWidth: 1, borderTopColor: PC.border,
            marginTop: 6,
          }}>
            {/* Encabezado */}
            <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
              <Text style={[hdrCell, { width: W.fecha }]}>Fecha</Text>
              <Text style={[hdrCell, { width: W.sector }]}>Sector</Text>
              <Text style={[hdrCell, { width: W.bandejas }]}>Cant.{'\n'}Bandejas</Text>
              <Text style={[hdrCell, { width: W.loteLib }]}>Lote{'\n'}Lib. S/N</Text>
              <Text style={[hdrCell, { width: W.comprobante }]}>No. Comprobante{'\n'}o Vale Interno</Text>
              <Text style={[hdrCell, { width: W.trazabilidad }]}>Codigo de{'\n'}Trazabilidad</Text>
              <Text style={[hdrCell, { width: W.marcaEmbalaje }]}>Marca y{'\n'}Embalaje</Text>
              <Text style={[hdrCell, { width: W.destino }]}>Destino{'\n'}Final</Text>
              <Text style={[hdrCell, { width: W.frutaKg }]}>Fruta{'\n'}Proc. Kg</Text>
              <Text style={[hdrCell, { width: W.encargado }]}>Encargado de la{'\n'}Liberacion</Text>
              <Text style={[hdrCell, { width: W.verif }]}>Verif.{'\n'}Semanal</Text>
              <Text style={[hdrCell, { width: W.observaciones }]}>Observaciones{'\n'}(Hora inicio y final)</Text>
            </View>

            {/* Filas */}
            {liberaciones.length === 0 ? (
              <View style={{ flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 7, color: PC.textSub }}>Sin liberaciones registradas</Text>
              </View>
            ) : (
              liberaciones.map((lib, i) => (
                <View key={i} style={{ flexDirection: 'row', backgroundColor: i % 2 !== 0 ? '#F5F9FE' : PC.white }}>
                  <Text style={[cell, { width: W.fecha, textAlign: 'center' }]}>{fecha}</Text>
                  <Text style={[cell, { width: W.sector }]}>{lib.sector ?? '—'}</Text>
                  <Text style={[cell, { width: W.bandejas, textAlign: 'center' }]}>
                    {lib.cantidad_bandejas ?? '—'}
                  </Text>
                  <CeldaSiNo width={W.loteLib} valor={lib.lote_liberado} />
                  <Text style={[cell, { width: W.comprobante, fontSize: 6.5 }]}>
                    {lib.numero_comprobante ?? '—'}
                  </Text>
                  <Text style={[cell, { width: W.trazabilidad, fontSize: 6.5 }]}>
                    {lib.codigo_trazabilidad ?? '—'}
                  </Text>
                  <Text style={[cell, { width: W.marcaEmbalaje, fontSize: 6.5 }]}>
                    {lib.marca_embalaje ?? '—'}
                  </Text>
                  <Text style={[cell, { width: W.destino, fontSize: 6.5 }]}>
                    {lib.destino_final ?? '—'}
                  </Text>
                  <Text style={[cell, { width: W.frutaKg, textAlign: 'center' }]}>
                    {lib.fruta_proceso_kg != null ? lib.fruta_proceso_kg.toString() : '—'}
                  </Text>
                  <Text style={[cell, { width: W.encargado, fontSize: 6.5 }]}>
                    {lib.encargado_nombre ?? '—'}
                  </Text>
                  <CeldaSiNo width={W.verif} valor={lib.verificacion_semanal} />
                  <Text style={[cell, { width: W.observaciones, fontSize: 6.5 }]}>
                    {formatObservaciones(lib.hora_inicio_cosecha, lib.hora_fin_cosecha, lib.observaciones)}
                  </Text>
                </View>
              ))
            )}
          </View>

          <PdfSectionBanner>3. Firmas y responsables</PdfSectionBanner>
          <PdfSignatures
            signatures={[
              { label: 'Verificó el registro', nombre: '', caption: 'Responsable de Inocuidad — Firma' },
              { label: '', nombre: '', caption: '' },
            ]}
          />

        </View>
      </PdfPageFrame>
    </Page>
  )
}

// ── CosechaLiberacionPDF ──────────────────────────────────────────────────────

export function CosechaLiberacionPDF(props: CosechaLiberacionPaginaProps) {
  return (
    <Document
      title={`Cosecha y Liberacion ${props.fecha}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Registro de Cosecha y Liberación — ${props.rancho}`}
      keywords="MADY, inocuidad, cosecha, liberacion"
    >
      <CosechaLiberacionPagina {...props} />
    </Document>
  )
}

// ── CosechaLiberacionConsolidadoPDF ──────────────────────────────────────────

export function CosechaLiberacionConsolidadoPDF({
  registros, ranchoNombre, desde, hasta,
}: CosechaLiberacionConsolidadoPDFProps) {
  return (
    <Document
      title={`Cosecha y Liberacion Consolidado ${ranchoNombre} ${desde} ${hasta}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Registro Consolidado de Cosecha y Liberación"
      keywords="MADY, inocuidad, cosecha, liberacion, consolidado"
    >
      {registros.map((reg, i) => (
        <CosechaLiberacionPagina key={i} {...reg} />
      ))}
    </Document>
  )
}
