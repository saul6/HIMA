import { Document, Page, View, Text } from '@react-pdf/renderer'
import { TopBar, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface MantenimientoEquiposGGFilaPDF {
  id: string
  rancho: string
  fecha: string
  equipo: string | null
  realizo: string | null
  tipo_actividad: 'verificacion' | 'preventivo' | 'correctivo' | null
  fugas_tanque_bomba: string | null
  mangueras: string | null
  pistola: string | null
  lanzas: string | null
  boquillas: string | null
  descripcion_trabajo: string | null
  observaciones: string | null
}

export interface MantenimientoEquiposGGPDFProps {
  fila: MantenimientoEquiposGGFilaPDF
  orgNombre?: string | null
  firmaRealizo?: FirmaParaPdf | null
}

const MARGIN = 20

type CheckVal = 'si' | 'no' | 'na'

const TIPO_LABELS: Record<string, string> = {
  verificacion: 'Verificacion',
  preventivo: 'Preventivo',
  correctivo: 'Correctivo',
}

const CHECK_LABELS: { key: keyof MantenimientoEquiposGGFilaPDF; label: string }[] = [
  { key: 'fugas_tanque_bomba', label: 'Libre de fugas tanque/bomba' },
  { key: 'mangueras', label: 'Mangueras libres de fugas' },
  { key: 'pistola', label: 'Estado de la pistola' },
  { key: 'lanzas', label: 'Estado de lanzas/varillas' },
  { key: 'boquillas', label: 'Estado de las boquillas' },
]

function formatFecha(iso: string) {
  try { return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return iso }
}

function TipoActividadBloque({ tipo }: { tipo: string | null }) {
  const tipos: Array<'verificacion' | 'preventivo' | 'correctivo'> = ['verificacion', 'preventivo', 'correctivo']
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginVertical: 4 }}>
      {tipos.map((t) => {
        const activo = tipo === t
        return (
          <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 12, height: 12, borderWidth: 1, borderColor: PC.border, backgroundColor: activo ? PC.section : PC.white, alignItems: 'center', justifyContent: 'center' }}>
              {activo && <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: PC.white }}>X</Text>}
            </View>
            <Text style={{ fontSize: 8, color: PC.fieldValue }}>{TIPO_LABELS[t]}</Text>
          </View>
        )
      })}
    </View>
  )
}

function CheckTabla({ fila }: { fila: MantenimientoEquiposGGFilaPDF }) {
  const COL = { label: 280, si: 70, no: 70, na: 70 }
  return (
    <View style={{ borderWidth: 1, borderColor: PC.border }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: COL.label, backgroundColor: PC.section, padding: '3px 6px', borderRightWidth: 1, borderRightColor: '#5599CC' }}>
          <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.white }}>Componente</Text>
        </View>
        {(['Si', 'No', 'N/A'] as const).map((lbl, i, arr) => (
          <View key={lbl} style={{ width: COL.si, backgroundColor: PC.section, alignItems: 'center', justifyContent: 'center', borderRightWidth: i < arr.length - 1 ? 1 : 0, borderRightColor: '#5599CC', padding: '3px 4px' }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.white }}>{lbl}</Text>
          </View>
        ))}
      </View>
      {CHECK_LABELS.map(({ key, label }, i) => {
        const val = (fila[key] as CheckVal | null) ?? 'si'
        const bg = i % 2 === 0 ? PC.white : '#F5F9FE'
        return (
          <View key={key as string} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: PC.border }}>
            <View style={{ width: COL.label, padding: '4px 6px', backgroundColor: bg, borderRightWidth: 1, borderRightColor: PC.border }}>
              <Text style={{ fontSize: 8, color: PC.fieldValue }}>{label}</Text>
            </View>
            {(['si', 'no', 'na'] as CheckVal[]).map((v, j, arr) => (
              <View key={v} style={{ width: COL.si, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, borderRightWidth: j < arr.length - 1 ? 1 : 0, borderRightColor: PC.border, padding: '4px 2px' }}>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: PC.fieldValue }}>{val === v ? 'X' : ''}</Text>
              </View>
            ))}
          </View>
        )
      })}
    </View>
  )
}

export function MantenimientoEquiposGGPagina({ fila, orgNombre, firmaRealizo }: MantenimientoEquiposGGPDFProps) {
  return (
    <Page size="A4" style={{ fontFamily: 'Helvetica', fontSize: 8, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}>
      <PdfFooter moduloCodigo="REG-09" />
      <TopBar />
      <PdfHeader
        titulo="VERIFICACION Y MANTENIMIENTO DE EQUIPOS DE APLICACION"
        subtitulo={`REG-09 · GlobalGAP | ${fila.rancho}`}
        codigoFormato="REG-09"
        folio={fila.fecha}
        fecha={fila.fecha}
      />

      <PdfSectionBanner>Datos generales</PdfSectionBanner>
      <PdfFieldGrid>
        <PdfFieldRow>
          {orgNombre && <PdfField label="Empresa" value={orgNombre} />}
          <PdfField label="Rancho / instalacion" value={fila.rancho} />
          <PdfField label="Fecha" value={formatFecha(fila.fecha)} />
        </PdfFieldRow>
        <PdfFieldRow>
          <PdfField label="Equipo" value={fila.equipo ?? '—'} />
          <PdfField label="Realizo" value={fila.realizo ?? '—'} />
        </PdfFieldRow>
      </PdfFieldGrid>

      <PdfSectionBanner>Tipo de actividad</PdfSectionBanner>
      <View style={{ paddingHorizontal: 4, marginBottom: 6 }}>
        <TipoActividadBloque tipo={fila.tipo_actividad} />
      </View>

      <PdfSectionBanner>Estado de componentes</PdfSectionBanner>
      <CheckTabla fila={fila} />

      {fila.descripcion_trabajo && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 7.5, color: PC.textSub, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>Descripcion del trabajo:</Text>
          <Text style={{ fontSize: 8, color: PC.fieldValue }}>{fila.descripcion_trabajo}</Text>
        </View>
      )}
      {fila.observaciones && (
        <View style={{ marginTop: 6 }}>
          <Text style={{ fontSize: 7.5, color: PC.textSub, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>Observaciones:</Text>
          <Text style={{ fontSize: 8, color: PC.fieldValue }}>{fila.observaciones}</Text>
        </View>
      )}

      <PdfSignatures
        signatures={[
          { label: '', nombre: '', caption: 'Nombre y firma de quien realiza', firma: firmaRealizo ?? null },
        ]}
      />
    </Page>
  )
}

export function MantenimientoEquiposGGPDF(props: MantenimientoEquiposGGPDFProps) {
  return (
    <Document>
      <MantenimientoEquiposGGPagina {...props} />
    </Document>
  )
}

export function MantenimientoEquiposGGConsolidadoPDF({ filas, orgNombre }: {
  filas: MantenimientoEquiposGGFilaPDF[]
  orgNombre?: string | null
}) {
  // Landscape to fit all check columns
  // COL widths: fecha=60 rancho=90 equipo=80 actividad=60 fugas=45 mang=45 pistola=45 lanzas=45 boq=45 realizo=90 desc=96
  // Usable landscape ≈ 801 pt
  const COL = { fecha: 60, rancho: 90, equipo: 80, actividad: 62, check: 45, realizo: 88, desc: 91 }
  // 5 checks = 225, total = 60+90+80+62+225+88+91 = 696... add padding

  function formatFechaCorta(iso: string) {
    try { return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) }
    catch { return iso }
  }

  const CHECK_COLS: { key: keyof MantenimientoEquiposGGFilaPDF; short: string }[] = [
    { key: 'fugas_tanque_bomba', short: 'Fugas' },
    { key: 'mangueras', short: 'Mang.' },
    { key: 'pistola', short: 'Pistola' },
    { key: 'lanzas', short: 'Lanzas' },
    { key: 'boquillas', short: 'Boq.' },
  ]

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={{ fontFamily: 'Helvetica', fontSize: 8, padding: MARGIN, paddingBottom: 50, backgroundColor: PC.white }}>
        <PdfFooter moduloCodigo="REG-09" />
        <TopBar />
        <PdfHeader
          titulo="VERIFICACION Y MANTENIMIENTO DE EQUIPOS — CONSOLIDADO"
          subtitulo={orgNombre ? `GlobalGAP | ${orgNombre}` : 'GlobalGAP'}
          codigoFormato="REG-09"
          folio="Consolidado"
          fecha={filas[0]?.fecha ?? ''}
        />

        <View style={{ borderWidth: 1, borderColor: PC.border, marginTop: 8 }}>
          <View style={{ flexDirection: 'row' }}>
            {[
              { label: 'Fecha', w: COL.fecha },
              { label: 'Rancho', w: COL.rancho },
              { label: 'Equipo', w: COL.equipo },
              { label: 'Actividad', w: COL.actividad },
            ].map(({ label, w }, i) => (
              <View key={label} style={{ width: w, backgroundColor: PC.section, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#5599CC', padding: '3px 4px' }}>
                <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PC.white, textAlign: 'center' }}>{label}</Text>
              </View>
            ))}
            {CHECK_COLS.map(({ short }, i) => (
              <View key={short} style={{ width: COL.check, backgroundColor: PC.section, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#5599CC', padding: '3px 2px' }}>
                <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: PC.white, textAlign: 'center' }}>{short}</Text>
              </View>
            ))}
            <View style={{ width: COL.realizo, backgroundColor: PC.section, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#5599CC', padding: '3px 4px' }}>
              <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PC.white }}>Realizo</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: PC.section, alignItems: 'center', justifyContent: 'center', padding: '3px 4px' }}>
              <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PC.white }}>Descripcion</Text>
            </View>
          </View>
          {filas.map((f, i) => {
            const bg = i % 2 === 0 ? PC.white : '#F5F9FE'
            const tipo = f.tipo_actividad ? (TIPO_LABELS[f.tipo_actividad] ?? f.tipo_actividad) : '—'
            return (
              <View key={f.id} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: PC.border }}>
                <View style={{ width: COL.fecha, padding: '3px 4px', backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: PC.border }}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue, textAlign: 'center' }}>{formatFechaCorta(f.fecha)}</Text>
                </View>
                <View style={{ width: COL.rancho, padding: '3px 4px', backgroundColor: bg, borderRightWidth: 1, borderRightColor: PC.border }}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{f.rancho}</Text>
                </View>
                <View style={{ width: COL.equipo, padding: '3px 4px', backgroundColor: bg, borderRightWidth: 1, borderRightColor: PC.border }}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{f.equipo ?? '—'}</Text>
                </View>
                <View style={{ width: COL.actividad, padding: '3px 4px', backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: PC.border }}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{tipo}</Text>
                </View>
                {CHECK_COLS.map(({ key }) => {
                  const val = (f[key] as string | null) ?? '—'
                  return (
                    <View key={key as string} style={{ width: COL.check, padding: '3px 2px', backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: PC.border }}>
                      <Text style={{ fontSize: 7, color: PC.fieldValue, fontFamily: 'Helvetica-Bold' }}>{val.toUpperCase() === 'SI' ? 'Si' : val.toUpperCase() === 'NO' ? 'No' : 'N/A'}</Text>
                    </View>
                  )
                })}
                <View style={{ width: COL.realizo, padding: '3px 4px', backgroundColor: bg, borderRightWidth: 1, borderRightColor: PC.border }}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{f.realizo ?? '—'}</Text>
                </View>
                <View style={{ flex: 1, padding: '3px 4px', backgroundColor: bg }}>
                  <Text style={{ fontSize: 7, color: PC.fieldValue }}>{f.descripcion_trabajo ?? ''}</Text>
                </View>
              </View>
            )
          })}
        </View>
      </Page>
    </Document>
  )
}
