import { Document, Page, View, Text } from '@react-pdf/renderer'
import { PdfPageFrame, PdfFooter } from '@/lib/pdf/components/PdfPage'
import { PdfHeader } from '@/lib/pdf/components/PdfHeader'
import { PdfSectionBanner } from '@/lib/pdf/components/PdfSectionBanner'
import { PdfFieldGrid, PdfFieldRow, PdfField } from '@/lib/pdf/components/PdfFieldGrid'
import { PdfTable, PdfTableRow, PdfTableCell } from '@/lib/pdf/components/PdfTable'
import { PdfChecklist } from '@/lib/pdf/components/PdfChecklist'
import { PdfSignatures } from '@/lib/pdf/components/PdfSignatures'
import { PC } from '@/lib/pdf/components/tokens'
import type { Aplicacion, AplicacionProducto, CatalogoProducto, Rancho, Profile } from '@/types/database.types'
import { formatFenologia } from '@/lib/fenologia'

type ProductoConCatalogo = AplicacionProducto & {
  catalogo_productos: CatalogoProducto
}

export interface AplicacionPDFProps {
  aplicacion: Aplicacion
  productos: ProductoConCatalogo[]
  rancho: Rancho
  asesor: Profile | null
  responsable: Profile | null
  operario: Profile
  /** Email del productor — fallback si nombre_completo está vacío */
  operarioEmail?: string
  /** Prefijo del código de formato (default 'MXA') */
  codigoClave?: string
  /** Término de sitio dinámico (default 'Rancho') */
  terminoSitio?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const val = (v: string | number | null | undefined, fallback = '—') =>
  v != null && v !== '' ? String(v) : fallback

const valNum = (v: number | null | undefined, fallback = '—') =>
  v != null ? parseFloat(v.toFixed(4)).toString() : fallback

// ── Constantes ───────────────────────────────────────────────────────────────

const PRODUCT_COLS: { label: string; width: number }[] = [
  { label: 'Justificación / Plaga', width: 82 },
  { label: 'Nivel infestación', width: 44 },
  { label: 'Nombre Comercial', width: 98 },
  { label: 'Ingrediente Activo', width: 93 },
  { label: 'Dosis/ha', width: 46 },
  { label: 'Dosis/barril (200L)', width: 62 },
  { label: 'Dosis total', width: 55 },
  { label: 'Días cosecha', width: 44 },
  { label: 'Re-entrada (hrs)', width: 40 },
  { label: 'RSCO/COFEPRIS', width: 96 },
]

const EPP_ITEMS: { key: keyof Aplicacion; label: string }[] = [
  { key: 'epp_traje', label: 'Traje protector' },
  { key: 'epp_guantes', label: 'Guantes' },
  { key: 'epp_googles', label: 'Googles' },
  { key: 'epp_botas', label: 'Botas' },
  { key: 'epp_mascarillas', label: 'Mascarillas' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function AplicacionPDF({
  aplicacion: ap,
  productos,
  rancho,
  asesor,
  responsable,
  operario,
  operarioEmail,
  codigoClave = 'MXA',
  terminoSitio = 'Rancho',
}: AplicacionPDFProps) {
  const productorNombre = operario.nombre_completo || operarioEmail || '—'
  const folio = ap.id.slice(0, 8).toUpperCase()
  const emision = new Date().toLocaleDateString('es-MX')
  const codigoFmt = `${codigoClave}-F-SC-SIG`

  const labelSitio = terminoSitio === 'Rancho' ? 'Rancho / Huerto' : terminoSitio

  const tieneObservaciones = Boolean(ap.observaciones)
  const numFirmas = tieneObservaciones ? 7 : 6

  return (
    <Document
      title="Registro de Aplicaciones Foliares de Agroquimicos"
      subject={`Formato operativo - ${rancho.nombre}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      keywords="MADY, inocuidad, formato, aplicaciones"
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

        {/* Footer fijo — va primero en el árbol para garantizar z-order correcto */}
        <PdfFooter moduloCodigo="M1" />

        {/* Marco exterior */}
        <PdfPageFrame>

          {/* Header */}
          <PdfHeader
            titulo="REGISTRO DE APLICACIONES FOLIARES DE AGROQUÍMICOS"
            subtitulo={`Formato operativo | ${rancho.nombre}`}
            codigoFormato={codigoFmt}
            folio={folio}
            fecha={emision}
          />

          {/* Área de contenido */}
          <View style={{ padding: 14 }}>

            {/* ── Sección 1 — Datos del productor y parcela ── */}
            <PdfSectionBanner>1. DATOS DEL PRODUCTOR Y PARCELA</PdfSectionBanner>
            <PdfFieldGrid>
              <PdfFieldRow>
                <PdfField label="Productor" value={productorNombre} />
                <PdfField label={labelSitio} value={val(rancho.nombre)} />
              </PdfFieldRow>
              <PdfFieldRow>
                <PdfField label="Cultivo" value={val(rancho.cultivo)} />
                <PdfField label="Variedad" value={val(ap.variedad)} />
              </PdfFieldRow>
              <PdfFieldRow>
                <PdfField label="Código de huerto" value={val(rancho.codigo)} />
                <PdfField label="Sector" value={val(ap.sector)} />
              </PdfFieldRow>
              <PdfFieldRow>
                <PdfField label="Superficie (ha)" value={val(ap.superficie_ha)} />
                <PdfField label="Etapa fenológica" value={formatFenologia(ap.fenologia ?? undefined)} />
              </PdfFieldRow>
            </PdfFieldGrid>

            {/* ── Sección 2 — Fechas, horarios y condiciones ── */}
            <PdfSectionBanner>2. FECHAS, HORARIOS Y CONDICIONES DE APLICACIÓN</PdfSectionBanner>
            <PdfFieldGrid>
              <PdfFieldRow>
                <PdfField label="Fecha recomendación asesor" value={val(ap.fecha_recomendacion)} />
                <PdfField label="Fecha real de aplicación" value={val(ap.fecha_aplicacion)} />
              </PdfFieldRow>
              <PdfFieldRow>
                <PdfField label="Hora inicio" value={val(ap.hora_inicio)} />
                <PdfField label="Hora fin" value={val(ap.hora_fin)} />
              </PdfFieldRow>
              <PdfFieldRow>
                <PdfField label="Tipo de aplicación" value={val(ap.tipo_aplicacion)} />
                <PdfField label="Total agua usada (L)" value={val(ap.total_agua_l)} />
              </PdfFieldRow>
              <PdfFieldRow>
                <PdfField label="Equipo de aplicación" value={val(ap.equipo)} />
                <PdfField label="Condición meteorológica" value={val(ap.condicion_meteorologica)} />
              </PdfFieldRow>
              <PdfFieldRow>
                <PdfField
                  label="Cloración"
                  value={
                    ap.cloracion
                      ? `Si — ${valNum(ap.cloro_cantidad_l)} ml · pH ${val(ap.cloro_ph)}`
                      : 'No'
                  }
                  fullWidth
                />
              </PdfFieldRow>
            </PdfFieldGrid>

            {/* ── Sección 3 — Productos aplicados ── */}
            <PdfSectionBanner>3. PRODUCTOS APLICADOS</PdfSectionBanner>
            <PdfTable columns={PRODUCT_COLS}>
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
                    <PdfTableCell width={PRODUCT_COLS[0].width} align="left">
                      {val(p.plaga_objetivo)}
                    </PdfTableCell>
                    <PdfTableCell width={PRODUCT_COLS[1].width}>
                      {val(p.nivel_infestacion)}
                    </PdfTableCell>
                    <PdfTableCell width={PRODUCT_COLS[2].width} align="left">
                      {val(p.catalogo_productos.nombre_comercial)}
                    </PdfTableCell>
                    <PdfTableCell width={PRODUCT_COLS[3].width} align="left">
                      {val(p.catalogo_productos.ingrediente_activo)}
                    </PdfTableCell>
                    <PdfTableCell width={PRODUCT_COLS[4].width}>
                      {valNum(p.dosis_ha)}
                    </PdfTableCell>
                    <PdfTableCell width={PRODUCT_COLS[5].width}>
                      {valNum(p.dosis_200l)}
                    </PdfTableCell>
                    <PdfTableCell width={PRODUCT_COLS[6].width}>
                      {valNum(p.total_producto)}
                    </PdfTableCell>
                    <PdfTableCell width={PRODUCT_COLS[7].width}>
                      {val(p.dias_cosecha)}
                    </PdfTableCell>
                    <PdfTableCell width={PRODUCT_COLS[8].width}>
                      {val(p.reentrada_hrs)}
                    </PdfTableCell>
                    <PdfTableCell width={PRODUCT_COLS[9].width} align="left">
                      {val(p.catalogo_productos.rsco)}
                    </PdfTableCell>
                  </PdfTableRow>
                ))
              )}
            </PdfTable>

            {/* ── Sección 4 — EPP ── */}
            <PdfSectionBanner>4. EQUIPO DE PROTECCIÓN PERSONAL (EPP)</PdfSectionBanner>
            <PdfChecklist
              items={EPP_ITEMS.map(({ key, label }) => ({
                label,
                checked: Boolean(ap[key]),
              }))}
            />

            {/* ── Sección 5 — Caldos sobrantes ── */}
            <PdfSectionBanner>5. CALDOS SOBRANTES</PdfSectionBanner>
            <PdfFieldGrid>
              <PdfFieldRow>
                <PdfField
                  label="¿Hubo caldos sobrantes?"
                  value={ap.caldos_sobrantes ? 'Si' : 'No'}
                />
                {ap.caldos_sobrantes ? (
                  <PdfField label="Cantidad (L)" value={val(ap.caldos_cantidad_l)} />
                ) : (
                  <PdfField label="" value="" />
                )}
              </PdfFieldRow>
              {ap.caldos_sobrantes && (
                <PdfFieldRow>
                  <PdfField label="Agua de lavado (L)" value={val(ap.caldos_agua_lavado_l)} />
                  <PdfField
                    label="¿Eliminado en área designada?"
                    value={
                      ap.caldos_area_designada === true
                        ? 'Si'
                        : ap.caldos_area_designada === false
                        ? 'No'
                        : '—'
                    }
                  />
                </PdfFieldRow>
              )}
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
                  label: 'Asesor técnico',
                  nombre: val(asesor?.nombre_completo),
                  caption: 'Firma del asesor técnico',
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
