// PATRÓN INOCUIDAD — PDF M46 (plantilla homogénea M.A.D.Y)
// Bitácora de Rondines de Vigilancia — A4 portrait.
// TopBar + PdfHeader + PdfSectionBanner + tabla rondas por área + PdfFooter.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface M46ItemPDF {
  id: string
  area: string
  nombre: string
}

export interface M46RondaPDF {
  numero: number
  hora: string | null
}

export interface M46ResultadoPDF {
  item_id: string
  ronda: number
  valor: 'sin_novedad' | 'con_novedad'
}

interface Props {
  rancho: string
  fecha: string
  turno: string | null
  vigilante: string
  jefe_seguridad: string | null
  observaciones: string | null
  items: M46ItemPDF[]
  rondas: M46RondaPDF[]
  resultados: M46ResultadoPDF[]
  codigoClave: string
  terminoSitio?: string
}

// ── Constantes ────────────────────────────────────────────────────────────────

const COL_PUNTO = 220
const ROW_ALT   = '#F5F9FE'
const NOVEDAD_COLOR = '#C02A2A'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFecha(f: string): string {
  try {
    const [y, m, d] = f.split('-')
    return `${d}/${m}/${y}`
  } catch { return f }
}

// ── Estilos de celda inline ───────────────────────────────────────────────────

const thStyle = { padding: 3, borderRightWidth: 1, borderRightColor: '#5599CC', borderBottomWidth: 1, borderBottomColor: '#5599CC', justifyContent: 'center', alignItems: 'center' } as const
const tdStyle = { borderRightWidth: 1, borderRightColor: PC.border, borderBottomWidth: 1, borderBottomColor: PC.border, padding: 3 } as const

// ── RondinesVigilanciaPDF ─────────────────────────────────────────────────────

export function RondinesVigilanciaPDF({
  rancho, fecha, turno, vigilante, jefe_seguridad, observaciones,
  items, rondas, resultados, codigoClave, terminoSitio = 'Instalación',
}: Props) {
  const emision   = new Date().toLocaleDateString('es-MX')
  const codigoFmt = codigoFormato('F-FRUS-ADM-07', codigoClave)

  const areas = Array.from(new Set(items.map((i) => i.area)))

  const resMap: Record<string, string> = {}
  for (const r of resultados) {
    resMap[`${r.item_id}|${r.ronda}`] = r.valor
  }

  const horaMap: Record<number, string> = {}
  for (const r of rondas) {
    horaMap[r.numero] = r.hora ?? '—'
  }

  const RONDAS = [1, 2, 3, 4]

  // Ancho por ronda: espacio disponible menos col punto, dividido entre rondas
  const PAGE_W_P = 595.28 - 40 // A4 portrait con padding 20 c/lado
  const COL_RONDA = Math.floor((PAGE_W_P - COL_PUNTO) / RONDAS.length)

  return (
    <Document
      title={`Rondines de Vigilancia — ${rancho} ${fmtFecha(fecha)}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
    >
      <Page
        size="A4"
        style={{ fontFamily: 'Helvetica', fontSize: 7, padding: 20, paddingBottom: 50, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="M46" />
        <TopBar />

        <PdfHeader
          titulo="BITACORA DE RONDINES DE VIGILANCIA"
          subtitulo={`Rondines | ${rancho} | ${fmtFecha(fecha)}`}
          codigoFormato={codigoFmt}
          folio={fmtFecha(fecha)}
          fecha={emision}
        />

        <PdfSectionBanner>1. Datos del sitio</PdfSectionBanner>
        <PdfFieldGrid>
          <PdfFieldRow>
            <PdfField label={terminoSitio} value={rancho} />
            <PdfField label="Fecha" value={fmtFecha(fecha)} />
            <PdfField label="Turno" value={turno ?? '—'} />
          </PdfFieldRow>
          <PdfFieldRow>
            <PdfField label="Vigilante" value={vigilante} />
            <PdfField label="Jefe de Seguridad" value={jefe_seguridad ?? '—'} />
            <PdfField label="" value="" />
          </PdfFieldRow>
        </PdfFieldGrid>

        <PdfSectionBanner>2. Rondines de vigilancia</PdfSectionBanner>

        {/* Tabla de rondines */}
        <View style={{ borderLeftWidth: 1, borderLeftColor: PC.border, borderTopWidth: 1, borderTopColor: PC.border, marginTop: 4 }}>
          {/* Encabezado */}
          <View style={{ flexDirection: 'row' }}>
            <View style={[thStyle, { width: COL_PUNTO, backgroundColor: PC.section }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, textAlign: 'center', color: PC.white }}>
                Area / Punto de supervision
              </Text>
            </View>
            {RONDAS.map((n) => (
              <View key={n} style={[thStyle, { width: COL_RONDA, backgroundColor: PC.section }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, textAlign: 'center', color: PC.white }}>
                  {`Ronda ${n}\n${horaMap[n] ?? '—'}`}
                </Text>
              </View>
            ))}
          </View>

          {/* Filas por área */}
          {areas.map((area) => {
            const areaItems = items.filter((i) => i.area === area)
            return (
              <View key={area}>
                {/* Banda de área */}
                <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
                  <View style={{ width: COL_PUNTO + COL_RONDA * RONDAS.length, padding: 3, borderBottomWidth: 1, borderBottomColor: '#5599CC' }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: PC.white }}>{area}</Text>
                  </View>
                </View>
                {/* Ítems del área */}
                {areaItems.map((item, idx) => {
                  const bg = idx % 2 === 1 ? ROW_ALT : PC.white
                  return (
                    <View key={item.id} style={{ flexDirection: 'row', backgroundColor: bg }}>
                      <View style={[tdStyle, { width: COL_PUNTO, justifyContent: 'center', backgroundColor: bg }]}>
                        <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{item.nombre}</Text>
                      </View>
                      {RONDAS.map((n) => {
                        const val = resMap[`${item.id}|${n}`] ?? 'sin_novedad'
                        const esNovedad = val === 'con_novedad'
                        return (
                          <View key={n} style={[tdStyle, { width: COL_RONDA, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}>
                            <Text style={{ fontSize: 6.5, textAlign: 'center', color: esNovedad ? NOVEDAD_COLOR : PC.fieldValue }}>
                              {esNovedad ? 'Con novedad' : 'Sin novedad'}
                            </Text>
                          </View>
                        )
                      })}
                    </View>
                  )
                })}
              </View>
            )
          })}
        </View>

        {observaciones ? (
          <View style={{ borderWidth: 1, borderColor: PC.border, padding: 4, marginTop: 6, minHeight: 20 }}>
            <Text style={{ fontSize: 5.5, color: PC.textSub, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>OBSERVACIONES</Text>
            <Text style={{ fontSize: 6.5, color: PC.fieldValue }}>{observaciones}</Text>
          </View>
        ) : null}

        <PdfSectionBanner>3. Firmas y responsables</PdfSectionBanner>
        <PdfSignatures
          signatures={[
            { label: '', nombre: '', caption: 'Firma del vigilante' },
            { label: '', nombre: '', caption: 'Jefe de Seguridad' },
          ]}
        />
      </Page>
    </Document>
  )
}
