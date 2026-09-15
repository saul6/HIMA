import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfPageFrame, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfTable, PdfTableRow, PdfTableCell } from '@/lib/pdf/components/PdfTable'
import { PdfChecklist } from '@/lib/pdf/components/PdfChecklist'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'
import type { AplicacionPDFProps } from './AplicacionPDF'
import { formatFenologia } from '@/lib/fenologia'

// ── Helpers ──────────────────────────────────────────────────────────────────

const val = (v: string | number | null | undefined, fallback = '—') =>
  v != null && v !== '' ? String(v) : fallback

const valNum = (v: number | null | undefined, fallback = '—') =>
  v != null ? parseFloat(v.toFixed(4)).toString() : fallback

// ── Columnas de productos GlobalG.A.P. ───────────────────────────────────────

const PRODUCT_COLS_GG: { label: string; width: number }[] = [
  { label: 'Justificacion / Plaga', width: 100 },
  { label: 'Nombre Comercial', width: 110 },
  { label: 'Ingrediente Activo', width: 110 },
  { label: 'No. RSCO/COFEPRIS', width: 90 },
  { label: 'Dosis por 200 L', width: 70 },
  { label: 'Cantidad total', width: 70 },
  { label: 'Int. Seguridad dias', width: 60 },
  { label: 'Reentrada hrs', width: 50 },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function AplicacionGlobalGapPDF({
  aplicacion: ap,
  productos,
  rancho,
  asesor,
  responsable,
  operario,
  operarioEmail,
}: AplicacionPDFProps) {
  const productorNombre = operario.nombre_completo || operarioEmail || '—'
  const folio = ap.id.slice(0, 8).toUpperCase()
  const emision = new Date().toLocaleDateString('es-MX')

  const tieneObservaciones = Boolean(ap.observaciones)
  const numFirmas = tieneObservaciones ? 7 : 6

  return (
    <Document
      title="Aplicaciones Foliares y de Plaguicidas — GlobalG.A.P. REG-21"
      subject={`REG-21 GlobalG.A.P. v6 - ${rancho.nombre}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      keywords="MADY, inocuidad, GlobalGAP, REG-21, aplicaciones"
    >
      <Page
        size="A4"
        orientation="landscape"
        style={{
          fontFamily: 'Helvetica',
          fontSize: 9,
          padding: 24,
          paddingBottom: 50,
          backgroundColor: PC.white,
        }}
      >

        {/* Footer fijo */}
        <PdfFooter moduloCodigo="M1" />

        {/* Marco exterior */}
        <PdfPageFrame>

          {/* Header */}
          <PdfHeader
            titulo="APLICACIONES FOLIARES Y DE PLAGUICIDAS"
            subtitulo={`REG-21 · GlobalG.A.P. v6 | ${rancho.nombre}`}
            codigoFormato="GG-REG-21"
            folio={folio}
            fecha={emision}
          />

          {/* Área de contenido */}
          <View style={{ padding: 14 }}>

            {/* ── Sección 1 — Datos de compañía y rancho ── */}
            <PdfSectionBanner>1. DATOS DE COMPAÑIA Y RANCHO</PdfSectionBanner>
            <PdfFieldGrid>
              <PdfFieldRow>
                <PdfField label="Productor" value={productorNombre} />
                <PdfField label="Rancho / Huerto" value={val(rancho.nombre)} />
              </PdfFieldRow>
              <PdfFieldRow>
                <PdfField label="Cultivo" value={val(rancho.cultivo)} />
                <PdfField label="Codigo de huerto" value={val(rancho.codigo)} />
              </PdfFieldRow>
              <PdfFieldRow>
                <PdfField label="Variedad" value={val(ap.variedad)} />
                <PdfField label="Etapa fenologica" value={formatFenologia(ap.fenologia ?? undefined)} />
              </PdfFieldRow>
              <PdfFieldRow>
                <PdfField label="Fecha de aplicacion" value={val(ap.fecha_aplicacion)} />
                <PdfField
                  label="Proxima cosecha"
                  value={val((ap as any).proxima_cosecha)}
                />
              </PdfFieldRow>
              <PdfFieldRow>
                <PdfField label="Hora inicio" value={val(ap.hora_inicio)} />
                <PdfField label="Hora fin" value={val(ap.hora_fin)} />
              </PdfFieldRow>
            </PdfFieldGrid>

            {/* ── Sección 2 — Método de aplicación y condiciones ── */}
            <PdfSectionBanner>2. METODO DE APLICACION Y CONDICIONES</PdfSectionBanner>
            <PdfFieldGrid>
              <PdfFieldRow>
                <PdfField
                  label="Metodo de aplicacion"
                  value={val((ap as any).metodo_aplicacion_gg)}
                />
                <PdfField label="Equipo utilizado" value={val(ap.equipo)} />
              </PdfFieldRow>
              <PdfFieldRow>
                <PdfField label="Total agua usada (L)" value={val(ap.total_agua_l)} />
                <PdfField label="Condicion climatica" value={val(ap.condicion_meteorologica)} />
              </PdfFieldRow>
              <PdfFieldRow>
                <PdfField
                  label="Cloracion"
                  value={
                    ap.cloracion
                      ? `Si — ${valNum(ap.cloro_cantidad_l)} ml · pH ${val(ap.cloro_ph)}`
                      : 'No'
                  }
                  fullWidth
                />
              </PdfFieldRow>
            </PdfFieldGrid>

            {/* ── Sección 3 — EPP (GlobalG.A.P. REG-21) ── */}
            <PdfSectionBanner>3. EQUIPO DE PROTECCION PERSONAL (EPP) — GlobalG.A.P. REG-21</PdfSectionBanner>
            <PdfChecklist
              items={[
                { label: 'Traje protector', checked: Boolean(ap.epp_traje) },
                { label: 'Mascarilla', checked: Boolean(ap.epp_mascarillas) },
                { label: 'Botas / Lentes', checked: Boolean(ap.epp_botas) || Boolean(ap.epp_googles) },
                { label: 'Guantes de nitrilo', checked: Boolean(ap.epp_guantes) },
              ]}
            />

            {/* ── Sección 4 — Productos aplicados ── */}
            <PdfSectionBanner>4. PRODUCTOS APLICADOS</PdfSectionBanner>
            <PdfTable columns={PRODUCT_COLS_GG}>
              {productos.length === 0 ? (
                <PdfTableRow>
                  <View
                    style={{
                      flex: 1,
                      borderRightWidth: 1,
                      borderRightColor: PC.border,
                      borderBottomWidth: 1,
                      borderBottomColor: PC.border,
                      padding: 6,
                    }}
                  >
                    <Text style={{ fontSize: 8, color: PC.fieldLabel, textAlign: 'center' }}>
                      Sin productos registrados
                    </Text>
                  </View>
                </PdfTableRow>
              ) : (
                productos.map((p, i) => (
                  <PdfTableRow key={p.id} alt={i % 2 !== 0}>
                    <PdfTableCell width={PRODUCT_COLS_GG[0].width} align="left">
                      {val(p.plaga_objetivo)}
                    </PdfTableCell>
                    <PdfTableCell width={PRODUCT_COLS_GG[1].width} align="left">
                      {val(p.catalogo_productos.nombre_comercial)}
                    </PdfTableCell>
                    <PdfTableCell width={PRODUCT_COLS_GG[2].width} align="left">
                      {val(p.catalogo_productos.ingrediente_activo)}
                    </PdfTableCell>
                    <PdfTableCell width={PRODUCT_COLS_GG[3].width} align="left">
                      {val(p.catalogo_productos.rsco)}
                    </PdfTableCell>
                    <PdfTableCell width={PRODUCT_COLS_GG[4].width}>
                      {valNum(p.dosis_200l)}
                    </PdfTableCell>
                    <PdfTableCell width={PRODUCT_COLS_GG[5].width}>
                      {valNum(p.total_producto)}
                    </PdfTableCell>
                    <PdfTableCell width={PRODUCT_COLS_GG[6].width}>
                      {val(p.dias_cosecha)}
                    </PdfTableCell>
                    <PdfTableCell width={PRODUCT_COLS_GG[7].width}>
                      {val(p.reentrada_hrs)}
                    </PdfTableCell>
                  </PdfTableRow>
                ))
              )}
            </PdfTable>

            {/* ── Sección 5 — Aplicadores y responsables ── */}
            <PdfSectionBanner>5. APLICADORES Y RESPONSABLES</PdfSectionBanner>
            <PdfFieldGrid>
              <PdfFieldRow>
                <PdfField
                  label="Aplicador(es)"
                  value={val(ap.aplicadores)}
                  fullWidth
                />
              </PdfFieldRow>
            </PdfFieldGrid>

            {/* ── Sección 6 — Observaciones (opcional) ── */}
            {tieneObservaciones && (
              <>
                <PdfSectionBanner>6. OBSERVACIONES</PdfSectionBanner>
                <PdfFieldGrid>
                  <PdfFieldRow>
                    <PdfField label="" value={ap.observaciones ?? ''} fullWidth />
                  </PdfFieldRow>
                </PdfFieldGrid>
              </>
            )}

            {/* ── Sección 6/7 — Firmas y responsables ── */}
            <PdfSectionBanner>{numFirmas}. FIRMAS Y RESPONSABLES</PdfSectionBanner>
            <PdfSignatures
              signatures={[
                {
                  label: 'Nombre(s) del aplicador',
                  nombre: val(ap.aplicadores),
                  caption: 'Firma del aplicador',
                },
                {
                  label: 'Asesor tecnico',
                  nombre: val(asesor?.nombre_completo),
                  caption: 'Firma del asesor tecnico',
                },
                {
                  label: 'Responsable de inocuidad',
                  nombre: val(responsable?.nombre_completo),
                  caption: 'Firma del responsable de inocuidad',
                },
              ]}
            />

          </View>
        </PdfPageFrame>

      </Page>
    </Document>
  )
}
