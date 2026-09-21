import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfPageFrame, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ReviewIssueReporte {
  severidad: 'BLOCKER' | 'REQUIRED' | 'WARNING' | 'INFO'
  mensaje: string
}

export interface PreguntaReporte {
  id: string
  question_id: string
  texto: string
  trigger_falla_automatica: string
  respuesta?: string
  campos: { etiqueta: string; valor: string }[]
  observacion?: string
}

export interface BloqueReporte {
  id: string
  codigo: string
  nombre: string
  preguntas: PreguntaReporte[]
}

export interface ModuloReporte {
  nombre: string
  bloques: BloqueReporte[]
}

export interface AuditorReportePDFProps {
  auditoriaId: string
  fecha: string
  auditorNombre: string | null
  tipoOperacion: string | null
  producto: string | null
  periodo: string | null
  instalacionNombre: string | null
  instalacionUbicacion: string | null
  productorNombre: string | null
  ranchoNombre: string | null
  modulos: ModuloReporte[]
  reviewIssues?: ReviewIssueReporte[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFechaPDF(f: string): string {
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

const RESP_LABELS: Record<string, string> = {
  cumplimiento_total: 'Cumplimiento total',
  deficiencia_menor:  'Deficiencia menor',
  deficiencia_mayor:  'Deficiencia mayor',
  no_conformidad:     'No conformidad',
  na:                 'No aplica',
}

const SEV_COLORS: Record<string, string> = {
  BLOCKER:  '#993C1D',
  REQUIRED: '#854F0B',
  WARNING:  '#854F0B',
  INFO:     '#0D5A8F',
}
const SEV_BG: Record<string, string> = {
  BLOCKER:  '#FAECE7',
  REQUIRED: '#FAEEDA',
  WARNING:  '#FAEEDA',
  INFO:     '#E3F2FD',
}

const RESP_COLOR: Record<string, string> = {
  cumplimiento_total: '#0D5A8F',
  deficiencia_menor:  '#854F0B',
  deficiencia_mayor:  '#854F0B',
  no_conformidad:     '#993C1D',
  na:                 '#717182',
}

const RESP_BG: Record<string, string> = {
  cumplimiento_total: '#E3F2FD',
  deficiencia_menor:  '#FAEEDA',
  deficiencia_mayor:  '#FAEEDA',
  no_conformidad:     '#FAECE7',
  na:                 '#ececf0',
}

// ── Estilos ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    backgroundColor: PC.white,
    padding: 20,
    paddingBottom: 48,
  },
  // Ficha de datos de la auditoría
  fichaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  fichaItem: {
    flex: 1,
    backgroundColor: '#f3f3f5',
    borderRadius: 6,
    padding: 6,
  },
  fichaLabel: {
    fontSize: 7,
    color: PC.fieldLabel,
    marginBottom: 2,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  fichaValue: {
    fontSize: 9,
    color: PC.fieldValue,
    fontFamily: 'Helvetica',
  },
  // Banner de módulo
  moduloBanner: {
    backgroundColor: '#233546',
    borderRadius: 6,
    padding: '6 10',
    marginTop: 12,
    marginBottom: 4,
  },
  moduloNombre: {
    color: PC.white,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  // Banner de bloque
  bloqueBanner: {
    backgroundColor: '#ececf0',
    padding: '4 10',
    marginTop: 6,
    marginBottom: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 4,
  },
  bloqueCodigo: {
    fontSize: 7,
    color: PC.textSub,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#dde2e8',
    borderRadius: 3,
    padding: '1 4',
  },
  bloqueNombre: {
    fontSize: 8,
    color: PC.titleNavy,
    fontFamily: 'Helvetica-Bold',
    flex: 1,
  },
  // Tarjeta de pregunta
  preguntaCard: {
    borderWidth: 1,
    borderColor: PC.border,
    borderRadius: 6,
    padding: '6 8',
    marginBottom: 4,
    backgroundColor: PC.white,
  },
  preguntaTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 5,
  },
  qid: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: PC.textSub,
    backgroundColor: '#ececf0',
    borderRadius: 3,
    padding: '1 4',
    flexShrink: 0,
  },
  preguntaTexto: {
    fontSize: 8,
    color: PC.fieldValue,
    flex: 1,
    lineHeight: 1.4,
  },
  respChip: {
    borderRadius: 4,
    padding: '2 5',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  sinRespuesta: {
    fontSize: 7,
    color: PC.footerGray,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  // Campos mínimos
  camposSection: {
    borderTopWidth: 1,
    borderTopColor: PC.border,
    paddingTop: 5,
    marginTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  campoItem: {
    minWidth: '30%',
    flex: 1,
  },
  campoLabel: {
    fontSize: 6.5,
    color: PC.fieldLabel,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 1.5,
  },
  campoValue: {
    fontSize: 8,
    color: PC.fieldValue,
  },
  // Observación
  obsSection: {
    borderTopWidth: 1,
    borderTopColor: PC.border,
    paddingTop: 4,
    marginTop: 4,
  },
  obsLabel: {
    fontSize: 6.5,
    color: PC.fieldLabel,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 1.5,
  },
  obsText: {
    fontSize: 8,
    color: PC.fieldValue,
    lineHeight: 1.4,
  },
  // Sección de datos
  datosSectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: PC.textSub,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 10,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: PC.border,
    marginVertical: 8,
  },
  // Sección de issues de validación
  issuesSection: {
    borderWidth: 1,
    borderColor: '#F5A623',
    borderRadius: 6,
    padding: '6 10',
    marginBottom: 10,
  },
  issuesSectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#854F0B',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 3,
  },
  issueSevChip: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    borderRadius: 3,
    padding: '1 4',
    flexShrink: 0,
  },
  issueMsg: {
    fontSize: 7.5,
    color: PC.fieldValue,
    flex: 1,
    lineHeight: 1.35,
  },
  // Disclaimer institucional
  disclaimer: {
    borderTopWidth: 1,
    borderTopColor: PC.border,
    marginTop: 16,
    paddingTop: 8,
    paddingHorizontal: 2,
  },
  disclaimerText: {
    fontSize: 7,
    color: PC.footerGray,
    lineHeight: 1.45,
    textAlign: 'center',
  },
})

// ── Sub-componentes ───────────────────────────────────────────────────────────

function PreguntaRow({ p }: { p: PreguntaReporte }) {
  const resp = p.respuesta
  const label = resp ? (RESP_LABELS[resp] ?? resp) : null
  const color = resp ? (RESP_COLOR[resp] ?? PC.textSub) : undefined
  const bg    = resp ? (RESP_BG[resp] ?? '#ececf0') : undefined
  const hayFalla =
    resp && resp !== 'na' && (
      (p.trigger_falla_automatica === 'cualquier_descuento' && resp !== 'cumplimiento_total') ||
      (p.trigger_falla_automatica === 'solo_cero' && resp === 'no_conformidad')
    )

  return (
    <View style={[S.preguntaCard, hayFalla ? { borderColor: '#C02A2A', borderWidth: 1.5 } : {}]}>
      <View style={S.preguntaTop}>
        <Text style={S.qid}>{p.question_id}</Text>
        <Text style={S.preguntaTexto}>{p.texto}</Text>
        {label ? (
          <Text style={[S.respChip, { backgroundColor: bg!, color: color! }]}>{label}</Text>
        ) : (
          <Text style={[S.respChip, { backgroundColor: '#ececf0', color: PC.footerGray }]}>—</Text>
        )}
      </View>

      {p.campos.length > 0 && (
        <View style={S.camposSection}>
          {p.campos.map((c, i) => (
            <View key={i} style={S.campoItem}>
              <Text style={S.campoLabel}>{c.etiqueta}</Text>
              <Text style={S.campoValue}>{c.valor || '—'}</Text>
            </View>
          ))}
        </View>
      )}

      {p.observacion && (
        <View style={S.obsSection}>
          <Text style={S.obsLabel}>Observacion</Text>
          <Text style={S.obsText}>{p.observacion}</Text>
        </View>
      )}
    </View>
  )
}

// ── Documento principal ────────────────────────────────────────────────────────

export function AuditorReportePDF({
  auditoriaId,
  fecha,
  auditorNombre,
  tipoOperacion,
  producto,
  periodo,
  instalacionNombre,
  instalacionUbicacion,
  productorNombre,
  ranchoNombre,
  modulos,
  reviewIssues,
}: AuditorReportePDFProps) {
  const esEfimera = !!instalacionNombre
  const nombrePrincipal = esEfimera ? (instalacionNombre ?? '—') : (productorNombre ?? '—')
  const subNombre = esEfimera ? (instalacionUbicacion ?? '') : (ranchoNombre ?? '')

  const folio = auditoriaId.slice(0, 8).toUpperCase()

  return (
    <Document>
      <Page size="A4" style={S.page}>
        <PdfPageFrame>
          <PdfHeader
            titulo="Reporte de Auditoria PrimusGFS"
            subtitulo={`${nombrePrincipal}${subNombre ? ` · ${subNombre}` : ''}`}
            codigoFormato="AUD-RPT"
            folio={folio}
            fecha={formatFechaPDF(fecha)}
          />

          {/* Datos de la auditoría */}
          <View style={{ padding: '10 14 0' }}>
            <Text style={S.datosSectionTitle}>Datos de la auditoria</Text>

            <View style={S.fichaRow}>
              <View style={S.fichaItem}>
                <Text style={S.fichaLabel}>{esEfimera ? 'Instalacion' : 'Empresa auditada'}</Text>
                <Text style={S.fichaValue}>{nombrePrincipal}</Text>
              </View>
              {subNombre ? (
                <View style={S.fichaItem}>
                  <Text style={S.fichaLabel}>{esEfimera ? 'Ubicacion' : 'Instalacion'}</Text>
                  <Text style={S.fichaValue}>{subNombre}</Text>
                </View>
              ) : null}
              <View style={S.fichaItem}>
                <Text style={S.fichaLabel}>Fecha</Text>
                <Text style={S.fichaValue}>{formatFechaPDF(fecha)}</Text>
              </View>
            </View>

            <View style={S.fichaRow}>
              {auditorNombre && (
                <View style={S.fichaItem}>
                  <Text style={S.fichaLabel}>Auditor</Text>
                  <Text style={S.fichaValue}>{auditorNombre}</Text>
                </View>
              )}
              {tipoOperacion && (
                <View style={S.fichaItem}>
                  <Text style={S.fichaLabel}>Tipo de operacion</Text>
                  <Text style={S.fichaValue}>{tipoOperacion}</Text>
                </View>
              )}
              {producto && (
                <View style={S.fichaItem}>
                  <Text style={S.fichaLabel}>Producto</Text>
                  <Text style={S.fichaValue}>{producto}</Text>
                </View>
              )}
              {periodo && (
                <View style={S.fichaItem}>
                  <Text style={S.fichaLabel}>Periodo</Text>
                  <Text style={S.fichaValue}>{periodo}</Text>
                </View>
              )}
              <View style={S.fichaItem}>
                <Text style={S.fichaLabel}>Norma</Text>
                <Text style={S.fichaValue}>PrimusGFS v3.2</Text>
              </View>
            </View>

            <View style={S.divider} />
          </View>

          {/* Módulos y preguntas */}
          <View style={{ padding: '0 14 14' }}>
            {modulos.map((mod, mi) => (
              <View key={mi}>
                <View style={S.moduloBanner}>
                  <Text style={S.moduloNombre}>{mod.nombre}</Text>
                </View>

                {mod.bloques.map((bloque, bi) => (
                  <View key={bi}>
                    <View style={S.bloqueBanner}>
                      <Text style={S.bloqueCodigo}>{bloque.codigo}</Text>
                      <Text style={S.bloqueNombre}>{bloque.nombre}</Text>
                    </View>

                    {bloque.preguntas.map((p, pi) => (
                      <PreguntaRow key={pi} p={p} />
                    ))}
                  </View>
                ))}
              </View>
            ))}

            {/* Observaciones de validación pendientes (opcional) */}
            {reviewIssues && reviewIssues.length > 0 && (
              <View style={S.issuesSection}>
                <Text style={S.issuesSectionTitle}>Observaciones de validacion pendientes</Text>
                {reviewIssues.map((iss, i) => (
                  <View key={i} style={S.issueRow}>
                    <Text style={[S.issueSevChip, {
                      backgroundColor: SEV_BG[iss.severidad] ?? '#ececf0',
                      color: SEV_COLORS[iss.severidad] ?? PC.textSub,
                    }]}>
                      {iss.severidad}
                    </Text>
                    <Text style={S.issueMsg}>{iss.mensaje}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Firma del auditor */}
            <PdfSignatures signatures={[{
              label: 'Auditor externo autorizado',
              nombre: '',
              caption: 'Firma y sello',
            }]} />

            {/* Leyenda institucional */}
            <View style={S.disclaimer}>
              <Text style={S.disclaimerText}>
                M.A.D.Y organiza, valida y da seguimiento. No sustituye a PrimusGFS, a Azzule Systems, al auditor autorizado ni al organismo de certificación. La decisión oficial corresponde al proceso externo.
              </Text>
            </View>
          </View>
        </PdfPageFrame>

        <PdfFooter moduloCodigo="AUD-RPT" />
      </Page>
    </Document>
  )
}
