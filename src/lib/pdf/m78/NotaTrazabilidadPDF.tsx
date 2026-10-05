import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface NotaTrazabilidadPDFProps {
  folio: string | null
  fecha: string
  productor: string | null
  hora_salida: string | null
  num_camion: string | null
  zona: string | null
  rancho: string
  sector: string | null
  cultivo: string | null
  presentacion: string | null
  otro_presentacion: string | null
  peso_bruto: number | null
  peso_neto: number | null
  total_producto: string | null
  embarco: string | null
  chofer: string | null
  recibio: string | null
  observaciones: string | null
  orgNombre?: string | null
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface NotaTrazabilidadConsolidadaRow {
  folio: string | null
  fecha: string
  rancho: string
  sector: string | null
  cultivo: string | null
  presentacion: string | null
  peso_bruto: number | null
  peso_neto: number | null
  total_producto: string | null
  chofer: string | null
  recibio: string | null
}

const MARGIN = 28

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

const PRESENTACIONES = ['Caja', 'Tote', 'Granel', 'Otro'] as const

export function NotaTrazabilidadPage({
  folio,
  fecha,
  productor,
  hora_salida,
  num_camion,
  zona,
  rancho,
  sector,
  cultivo,
  presentacion,
  otro_presentacion,
  observaciones,
  peso_bruto,
  peso_neto,
  total_producto,
  embarco,
  chofer,
  recibio,
  orgNombre,
  firmaRealizo,
  firmaVerifico,
}: NotaTrazabilidadPDFProps) {
  const folioStr = folio ?? ''

  return (
    <Page
      size="A4"
      orientation="portrait"
      style={{ fontFamily: 'Helvetica', fontSize: 9, padding: MARGIN, paddingBottom: 55, backgroundColor: PC.white }}
    >
      <PdfFooter moduloCodigo="NT" />
      <TopBar />
      <PdfHeader
        titulo="Nota de Trazabilidad"
        subtitulo={`GlobalG.A.P. v6 | ${rancho}`}
        codigoFormato="NT"
        folio={folioStr}
        fecha={fmtFecha(fecha)}
      />

      {/* Bloque de datos generales */}
      <PdfSectionBanner>Datos generales</PdfSectionBanner>

      <View style={{ borderWidth: 1, borderColor: PC.border, marginTop: 4 }}>
        {/* Fila 1: Fecha + Productor */}
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: PC.border }}>
          <View style={{ flex: 1, padding: 5, borderRightWidth: 1, borderRightColor: PC.border }}>
            <Text style={{ fontSize: 7, color: PC.fieldLabel, fontFamily: 'Helvetica-Bold' }}>Fecha</Text>
            <Text style={{ fontSize: 9, color: PC.fieldValue, marginTop: 2 }}>{fmtFecha(fecha)}</Text>
          </View>
          <View style={{ flex: 2, padding: 5 }}>
            <Text style={{ fontSize: 7, color: PC.fieldLabel, fontFamily: 'Helvetica-Bold' }}>Productor</Text>
            <Text style={{ fontSize: 9, color: PC.fieldValue, marginTop: 2 }}>{productor ?? ''}</Text>
          </View>
        </View>

        {/* Fila 2: Hora salida + Num camion + Zona */}
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: PC.border }}>
          <View style={{ flex: 1, padding: 5, borderRightWidth: 1, borderRightColor: PC.border }}>
            <Text style={{ fontSize: 7, color: PC.fieldLabel, fontFamily: 'Helvetica-Bold' }}>Hora de salida</Text>
            <Text style={{ fontSize: 9, color: PC.fieldValue, marginTop: 2 }}>{hora_salida ?? ''}</Text>
          </View>
          <View style={{ flex: 1, padding: 5, borderRightWidth: 1, borderRightColor: PC.border }}>
            <Text style={{ fontSize: 7, color: PC.fieldLabel, fontFamily: 'Helvetica-Bold' }}>Num. camion</Text>
            <Text style={{ fontSize: 9, color: PC.fieldValue, marginTop: 2 }}>{num_camion ?? ''}</Text>
          </View>
          <View style={{ flex: 1, padding: 5 }}>
            <Text style={{ fontSize: 7, color: PC.fieldLabel, fontFamily: 'Helvetica-Bold' }}>Zona</Text>
            <Text style={{ fontSize: 9, color: PC.fieldValue, marginTop: 2 }}>{zona ?? ''}</Text>
          </View>
        </View>

        {/* Fila 3: Rancho + Sector + Cultivo */}
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 2, padding: 5, borderRightWidth: 1, borderRightColor: PC.border }}>
            <Text style={{ fontSize: 7, color: PC.fieldLabel, fontFamily: 'Helvetica-Bold' }}>Rancho</Text>
            <Text style={{ fontSize: 9, color: PC.fieldValue, marginTop: 2 }}>{rancho}</Text>
          </View>
          <View style={{ flex: 1, padding: 5, borderRightWidth: 1, borderRightColor: PC.border }}>
            <Text style={{ fontSize: 7, color: PC.fieldLabel, fontFamily: 'Helvetica-Bold' }}>Sector</Text>
            <Text style={{ fontSize: 9, color: PC.fieldValue, marginTop: 2 }}>{sector ?? ''}</Text>
          </View>
          <View style={{ flex: 1, padding: 5 }}>
            <Text style={{ fontSize: 7, color: PC.fieldLabel, fontFamily: 'Helvetica-Bold' }}>Cultivo</Text>
            <Text style={{ fontSize: 9, color: PC.fieldValue, marginTop: 2 }}>{cultivo ?? ''}</Text>
          </View>
        </View>
      </View>

      {/* Presentación */}
      <PdfSectionBanner>Presentacion</PdfSectionBanner>
      <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: PC.border, marginTop: 4 }}>
        {PRESENTACIONES.map((p, i) => {
          const marcada = presentacion === p || (p === 'Otro' && presentacion === 'Otro')
          const etiqueta = p === 'Otro'
            ? `OTRO: ${presentacion === 'Otro' ? (otro_presentacion ?? '') : ''}`
            : p.toUpperCase()
          return (
            <View
              key={p}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                padding: 6,
                borderRightWidth: i < PRESENTACIONES.length - 1 ? 1 : 0,
                borderRightColor: PC.border,
              }}
            >
              <View style={{
                width: 10, height: 10, borderWidth: 1, borderColor: PC.border,
                marginRight: 4, justifyContent: 'center', alignItems: 'center',
              }}>
                {marcada && (
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: PC.section }}>X</Text>
                )}
              </View>
              <Text style={{ fontSize: 8, color: PC.fieldValue }}>{etiqueta}</Text>
            </View>
          )
        })}
      </View>

      {/* Tabla de pesos y observaciones */}
      <PdfSectionBanner>Pesos y observaciones</PdfSectionBanner>
      <View style={{ borderWidth: 1, borderColor: PC.border, marginTop: 4 }}>
        {/* Encabezado */}
        <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
          {['PESO BRUTO (Ton)', 'PESO NETO (Ton)', 'TOTAL DE PRODUCTO', 'OBSERVACIONES'].map((h, i) => (
            <View
              key={h}
              style={{
                flex: 1,
                padding: 5,
                borderRightWidth: i < 3 ? 1 : 0,
                borderRightColor: '#5599CC',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.white, textAlign: 'center' }}>{h}</Text>
            </View>
          ))}
        </View>
        {/* Fila de datos */}
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, padding: 7, borderRightWidth: 1, borderRightColor: PC.border, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: PC.fieldValue }}>{peso_bruto != null ? String(peso_bruto) : ''}</Text>
          </View>
          <View style={{ flex: 1, padding: 7, borderRightWidth: 1, borderRightColor: PC.border, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: PC.fieldValue }}>{peso_neto != null ? String(peso_neto) : ''}</Text>
          </View>
          <View style={{ flex: 1, padding: 7, borderRightWidth: 1, borderRightColor: PC.border, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: PC.fieldValue }}>{total_producto ?? ''}</Text>
          </View>
          <View style={{ flex: 1, padding: 7 }}>
            <Text style={{ fontSize: 9, color: PC.fieldValue }}>{observaciones ?? ''}</Text>
          </View>
        </View>
      </View>

      {/* Organización (si aplica) */}
      {orgNombre && (
        <View style={{ marginTop: 6 }}>
          <Text style={{ fontSize: 7, color: PC.fieldLabel }}>Organizacion: {orgNombre}</Text>
        </View>
      )}

      {/* Firmas externas: EMBARCÓ / CHOFER / RECIBIÓ */}
      <PdfSectionBanner>Firmas de operacion</PdfSectionBanner>
      <View style={{ flexDirection: 'row', marginTop: 4, borderWidth: 1, borderColor: PC.border }}>
        {[
          { label: 'EMBARCO', nombre: embarco },
          { label: 'CHOFER', nombre: chofer },
          { label: 'RECIBIO', nombre: recibio },
        ].map((f, i) => (
          <View
            key={f.label}
            style={{
              flex: 1,
              padding: 8,
              borderRightWidth: i < 2 ? 1 : 0,
              borderRightColor: PC.border,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 8, color: PC.fieldValue, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>
              {f.nombre ?? ''}
            </Text>
            <View style={{ borderBottomWidth: 1, borderBottomColor: PC.border, width: '100%', height: 28 }} />
            <Text style={{ fontSize: 7, color: PC.fieldLabel, marginTop: 2 }}>{f.label}</Text>
            <Text style={{ fontSize: 6, color: PC.fieldLabel }}>Nombre y Firma</Text>
          </View>
        ))}
      </View>

      {/* Firmas digitales (Realizó / Verificó) */}
      <PdfSignatures
        signatures={[
          { label: '', nombre: '', caption: 'Realizo', firma: firmaRealizo ?? null },
          { label: '', nombre: '', caption: 'Verifico', firma: firmaVerifico ?? null },
        ]}
      />
    </Page>
  )
}

export function NotaTrazabilidadPDF(props: NotaTrazabilidadPDFProps) {
  return (
    <Document>
      <NotaTrazabilidadPage {...props} />
    </Document>
  )
}

export function NotaTrazabilidadConsolidadoPDF({
  rows,
  orgNombre,
  desde,
  hasta,
}: {
  rows: NotaTrazabilidadConsolidadaRow[]
  orgNombre?: string | null
  desde: string
  hasta: string
}) {
  const colWidths = [40, 50, 80, 50, 60, 50, 45, 45, 55, 70, 60]
  const headers = [
    'Folio', 'Fecha', 'Rancho', 'Sector', 'Cultivo',
    'Presentacion', 'Peso Bruto', 'Peso Neto', 'Total', 'Chofer', 'Recibio',
  ]

  return (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={{ fontFamily: 'Helvetica', fontSize: 8, padding: MARGIN, paddingBottom: 55, backgroundColor: PC.white }}
      >
        <PdfFooter moduloCodigo="NT" />
        <TopBar />
        <PdfHeader
          titulo="Nota de Trazabilidad — Consolidado"
          subtitulo={`GlobalG.A.P. v6 | ${fmtFecha(desde)} al ${fmtFecha(hasta)}`}
          codigoFormato="NT"
          folio=""
          fecha={fmtFecha(hasta)}
        />
        {orgNombre && (
          <View style={{ marginTop: 4, marginBottom: 4 }}>
            <Text style={{ fontSize: 7, color: PC.fieldLabel }}>Organizacion: {orgNombre}</Text>
          </View>
        )}
        <View style={{ marginTop: 4, borderWidth: 1, borderColor: PC.border }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', backgroundColor: PC.section }}>
            {headers.map((h, i) => (
              <View
                key={h}
                style={{
                  width: colWidths[i],
                  padding: 4,
                  borderRightWidth: i < headers.length - 1 ? 1 : 0,
                  borderRightColor: '#5599CC',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: PC.white, textAlign: 'center' }}>{h}</Text>
              </View>
            ))}
          </View>
          {/* Rows */}
          {rows.map((row, ri) => {
            const bg = ri % 2 === 1 ? '#F5F9FE' : PC.white
            const presentStr = row.presentacion ?? ''
            const vals = [
              row.folio ?? '',
              fmtFecha(row.fecha),
              row.rancho,
              row.sector ?? '',
              row.cultivo ?? '',
              presentStr,
              row.peso_bruto != null ? String(row.peso_bruto) : '',
              row.peso_neto != null ? String(row.peso_neto) : '',
              row.total_producto ?? '',
              row.chofer ?? '',
              row.recibio ?? '',
            ]
            return (
              <View key={ri} style={{ flexDirection: 'row', backgroundColor: bg }}>
                {vals.map((v, ci) => (
                  <View
                    key={ci}
                    style={{
                      width: colWidths[ci],
                      padding: 4,
                      borderRightWidth: ci < vals.length - 1 ? 1 : 0,
                      borderRightColor: PC.border,
                      borderBottomWidth: 1,
                      borderBottomColor: PC.border,
                    }}
                  >
                    <Text style={{ fontSize: 7, color: PC.fieldValue }}>{v}</Text>
                  </View>
                ))}
              </View>
            )
          })}
        </View>
      </Page>
    </Document>
  )
}
