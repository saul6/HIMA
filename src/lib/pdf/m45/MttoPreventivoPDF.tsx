import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { MadyLogoPDF } from '@/lib/pdf/MadyLogoPDF'
import { codigoFormato } from '@/lib/codigoFormato'

export interface M45ItemPDFRow {
  id: string
  nombre: string
  frecuencia: string | null
  orden: number
}

export interface M45AreaPDF {
  area: string
  items: M45ItemPDFRow[]
}

export interface M45AccionesPDF {
  revision_general: boolean
  cambio_aceites: boolean
  cambio_piezas: boolean
  revision_electrico: boolean
}

export interface M45PaginaProps {
  instalacion: string
  instalacionCodigo: string
  anio: number
  mes: number
  mesLabel: string
  observaciones: string | null
  areas: M45AreaPDF[]
  resultados: Record<string, Record<number, string>>
  acciones: Record<string, M45AccionesPDF>
  codigoClave: string
}

export interface MttoPreventivoConsolidadoPDFProps {
  paginas: M45PaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

const PRIMARY  = '#2B7AB5'
const DARK     = '#1A1A1A'
const BORDER   = '#CCCCCC'
const WHITE    = '#FFFFFF'
const MUTED    = '#717182'
const ROW_ALT  = '#F5F9FE'
const HDR_BG   = '#E8F1F9'
const AREA_BG  = '#1E4976'
const H_COLOR  = '#0D5A8F'
const N_COLOR  = '#C02A2A'

const MARGIN   = 15
const PAGE_W   = 841.89 - MARGIN * 2   // ~812

// Column widths — total = 183 + 52 + 112 + 465 = 812
const ITEM_COL = 183
const FREC_COL = 52
const ACT_COL  = 28   // x4 = 112
const DAY_COL  = 15   // x31 = 465

function diasDelMes(anio: number, mes: number): number[] {
  const total = new Date(anio, mes, 0).getDate()
  const arr: number[] = []
  for (let i = 1; i <= total; i++) arr.push(i)
  return arr
}

function frecLabel(f: string | null): string {
  if (!f) return ''
  if (f === 'diario')     return 'Diario'
  if (f === 'tercer_dia') return '3er dia'
  if (f === 'semanal')    return 'Semanal'
  if (f === 'quincenal')  return 'Quincenal'
  return f
}

function valorSym(v: string | undefined): string {
  if (v === 'hecho')    return 'H'
  if (v === 'no_hecho') return 'N'
  if (v === 'na')       return '—'
  return ''
}

function valorColor(v: string | undefined): string {
  if (v === 'hecho')    return H_COLOR
  if (v === 'no_hecho') return N_COLOR
  return MUTED
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: DARK,
    paddingTop: MARGIN + 14,   // space for fixed top bar
    paddingBottom: MARGIN + 14,
    paddingLeft: MARGIN,
    paddingRight: MARGIN,
  },
  // Fixed top bar (repeats on every page)
  topBar: {
    position: 'absolute',
    top: 6,
    left: MARGIN,
    right: MARGIN,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarText: { flex: 1, fontSize: 5.5, color: MUTED, textAlign: 'center' },
  // Document header (first page only)
  docHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
    paddingBottom: 4,
  },
  docTitle:  { flex: 1, textAlign: 'center', fontSize: 8, fontFamily: 'Helvetica-Bold' },
  docMeta:   { width: 72, fontSize: 5.5, textAlign: 'right', color: MUTED },
  infoRow:   { flexDirection: 'row', gap: 4, marginBottom: 6 },
  infoBox:   {
    flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 2,
    paddingTop: 2, paddingBottom: 2, paddingLeft: 4, paddingRight: 4,
  },
  infoLabel: { fontSize: 5.5, color: MUTED, marginBottom: 1 },
  infoValue: { fontSize: 7, fontFamily: 'Helvetica-Bold' },
  // Area header
  areaHeader: {
    flexDirection: 'row',
    backgroundColor: AREA_BG,
    paddingTop: 3, paddingBottom: 3, paddingLeft: 5,
    marginTop: 5,
  },
  areaHeaderText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: WHITE },
  // Column header row
  colHeaderRow: { flexDirection: 'row' },
  itemColHdr: {
    width: ITEM_COL, borderWidth: 1, borderColor: BORDER, backgroundColor: HDR_BG,
    paddingTop: 2, paddingBottom: 2, paddingLeft: 3, justifyContent: 'center',
  },
  frecColHdr: {
    width: FREC_COL, borderWidth: 1, borderColor: BORDER, backgroundColor: HDR_BG,
    paddingTop: 2, paddingBottom: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  dayColHdr: {
    width: DAY_COL, borderWidth: 1, borderColor: BORDER, backgroundColor: HDR_BG,
    paddingTop: 2, paddingBottom: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  actColHdr: {
    width: ACT_COL, borderWidth: 1, borderColor: BORDER, backgroundColor: HDR_BG,
    paddingTop: 2, paddingBottom: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  colHdrText: { fontSize: 5, fontFamily: 'Helvetica-Bold', color: PRIMARY, textAlign: 'center' },
  // Data rows
  dataRow: { flexDirection: 'row' },
  itemCell: {
    width: ITEM_COL, borderWidth: 1, borderColor: BORDER,
    paddingTop: 2, paddingBottom: 2, paddingLeft: 3, justifyContent: 'center',
  },
  itemText: { fontSize: 5.5 },
  frecCell: {
    width: FREC_COL, borderWidth: 1, borderColor: BORDER,
    paddingTop: 2, paddingBottom: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  frecText: { fontSize: 5, color: MUTED },
  dayCell: {
    width: DAY_COL, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
    paddingTop: 2, paddingBottom: 2,
  },
  actCell: {
    width: ACT_COL, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
    paddingTop: 2, paddingBottom: 2,
  },
  // Footer
  footerSep:   { borderTopWidth: 1, borderTopColor: BORDER, marginTop: 8, paddingTop: 4 },
  firmaRow:    { flexDirection: 'row', gap: 12, marginTop: 6 },
  firmaBloque: { flex: 1, alignItems: 'center', borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 4 },
  firmaLabel:  { fontSize: 6, color: MUTED },
  leyenda:     { fontSize: 5, color: MUTED, marginTop: 4 },
  piePagina:   {
    position: 'absolute', bottom: 6, left: MARGIN, right: MARGIN,
    textAlign: 'center', fontSize: 5.5, color: MUTED,
  },
})

function MttoPreventivoPaginaContent({
  instalacion, instalacionCodigo, anio, mes, mesLabel, observaciones, areas, resultados, acciones, codigoClave,
}: M45PaginaProps) {
  const dias = diasDelMes(anio, mes)

  return (
    <>
      {/* Fixed top bar on every page */}
      <View style={s.topBar} fixed>
        <Text style={s.topBarText}>
          {`VERIFICACION, MANTENIMIENTO PREVENTIVO Y CORRECTIVO  |  ${instalacion}  |  ${mesLabel}  |  ${codigoFormato('F-FRUS-MTT-03', codigoClave)}`}
        </Text>
      </View>

      {/* Document header */}
      <View style={s.docHeader}>
        <View>
          <MadyLogoPDF style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: PRIMARY }} />
          <Text style={{ fontSize: 5.5, color: MUTED, marginTop: 1 }}>Inocuidad Alimentaria</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.docTitle}>VERIFICACION, MANTENIMIENTO PREVENTIVO Y CORRECTIVO</Text>
          <Text style={{ fontSize: 5.5, color: MUTED, marginTop: 1 }}>
            {`Codigo: ${codigoFormato('F-FRUS-MTT-03', codigoClave)}  |  Rev 01  |  Frecuencia: Mensual`}
          </Text>
        </View>
        <View style={s.docMeta}>
          <Text>Mes: {mesLabel}</Text>
        </View>
      </View>

      {/* Info boxes */}
      <View style={s.infoRow}>
        <View style={[s.infoBox, { flex: 3 }]}>
          <Text style={s.infoLabel}>Instalacion</Text>
          <Text style={s.infoValue}>{instalacion}</Text>
        </View>
        <View style={s.infoBox}>
          <Text style={s.infoLabel}>Codigo</Text>
          <Text style={s.infoValue}>{instalacionCodigo}</Text>
        </View>
        <View style={[s.infoBox, { flex: 2 }]}>
          <Text style={s.infoLabel}>Año</Text>
          <Text style={s.infoValue}>{anio}</Text>
        </View>
        <View style={[s.infoBox, { flex: 2 }]}>
          <Text style={s.infoLabel}>Mes</Text>
          <Text style={s.infoValue}>{mesLabel}</Text>
        </View>
      </View>

      {/* Legend */}
      <Text style={s.leyenda}>
        H = Hecho  |  N = No hecho  |  — = N/A  |  X = Accion realizada  |  Rev.Gral = Revision general  |  C.Aceit = Cambio aceites  |  C.Pzas = Cambio piezas  |  Rev.Elec = Revision electrica
      </Text>

      {/* Areas */}
      {areas.map((areaData) => (
        <View key={areaData.area}>
          {/* Area header */}
          <View style={s.areaHeader}>
            <Text style={s.areaHeaderText}>{areaData.area.toUpperCase()}</Text>
          </View>

          {/* Column header row */}
          <View style={s.colHeaderRow}>
            <View style={s.itemColHdr}>
              <Text style={s.colHdrText}>Equipo / Elemento</Text>
            </View>
            <View style={s.frecColHdr}>
              <Text style={s.colHdrText}>Frecuencia</Text>
            </View>
            {dias.map((d) => (
              <View key={d} style={s.dayColHdr}>
                <Text style={s.colHdrText}>{d}</Text>
              </View>
            ))}
            <View style={s.actColHdr}>
              <Text style={s.colHdrText}>{'Rev.\nGral'}</Text>
            </View>
            <View style={s.actColHdr}>
              <Text style={s.colHdrText}>{'C.\nAceit'}</Text>
            </View>
            <View style={s.actColHdr}>
              <Text style={s.colHdrText}>{'C.\nPzas'}</Text>
            </View>
            <View style={s.actColHdr}>
              <Text style={s.colHdrText}>{'Rev.\nElec'}</Text>
            </View>
          </View>

          {/* Item rows */}
          {areaData.items.map((item, idx) => {
            const bg  = idx % 2 === 0 ? WHITE : ROW_ALT
            const acc = acciones[item.id]
            return (
              <View key={item.id} style={[s.dataRow, { backgroundColor: bg }]}>
                <View style={[s.itemCell, { backgroundColor: bg }]}>
                  <Text style={s.itemText}>{item.nombre}</Text>
                </View>
                <View style={[s.frecCell, { backgroundColor: bg }]}>
                  <Text style={s.frecText}>{frecLabel(item.frecuencia)}</Text>
                </View>
                {dias.map((d) => {
                  const v     = resultados[item.id]?.[d]
                  const sym   = valorSym(v)
                  const color = valorColor(v)
                  return (
                    <View key={d} style={[s.dayCell, { backgroundColor: bg }]}>
                      {sym ? (
                        <Text style={{ fontSize: sym === '—' ? 6 : 5.5, fontFamily: 'Helvetica-Bold', color }}>
                          {sym}
                        </Text>
                      ) : null}
                    </View>
                  )
                })}
                <View style={[s.actCell, { backgroundColor: bg }]}>
                  {acc?.revision_general  ? <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: H_COLOR }}>X</Text> : null}
                </View>
                <View style={[s.actCell, { backgroundColor: bg }]}>
                  {acc?.cambio_aceites    ? <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: H_COLOR }}>X</Text> : null}
                </View>
                <View style={[s.actCell, { backgroundColor: bg }]}>
                  {acc?.cambio_piezas     ? <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: H_COLOR }}>X</Text> : null}
                </View>
                <View style={[s.actCell, { backgroundColor: bg }]}>
                  {acc?.revision_electrico ? <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: H_COLOR }}>X</Text> : null}
                </View>
              </View>
            )
          })}
        </View>
      ))}

      {/* Footer */}
      <View style={s.footerSep}>
        {observaciones ? (
          <View style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 6, color: MUTED }}>Observaciones:</Text>
            <Text style={{ fontSize: 7 }}>{observaciones}</Text>
          </View>
        ) : null}
        <View style={s.firmaRow}>
          <View style={s.firmaBloque}>
            <View style={{ height: 16 }} />
            <Text style={s.firmaLabel}>Responsable del Area</Text>
          </View>
          <View style={s.firmaBloque}>
            <View style={{ height: 16 }} />
            <Text style={s.firmaLabel}>Jefe de Mantenimiento</Text>
          </View>
          <View style={s.firmaBloque}>
            <View style={{ height: 16 }} />
            <Text style={s.firmaLabel}>Gerente de Operaciones</Text>
          </View>
        </View>
      </View>

      <Text style={s.piePagina} fixed>M.A.D.Y — DuoMind Solutions</Text>
    </>
  )
}

export function MttoPreventivoPDF(props: M45PaginaProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <MttoPreventivoPaginaContent {...props} />
      </Page>
    </Document>
  )
}

export function MttoPreventivoConsolidadoPDF({
  paginas, instalacionNombre, desde, hasta,
}: MttoPreventivoConsolidadoPDFProps) {
  return (
    <Document title={`Mtto. Preventivo — ${instalacionNombre} ${desde} a ${hasta}`}>
      {paginas.map((p, i) => (
        <Page key={i} size="A4" orientation="landscape" style={s.page}>
          <MttoPreventivoPaginaContent {...p} />
        </Page>
      ))}
    </Document>
  )
}
