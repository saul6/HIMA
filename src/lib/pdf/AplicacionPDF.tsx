import { Document, View } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion, fechaEmisionHoy } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { Checklist } from '@/lib/pdf/disenoNuevo/Checklist'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import type { Aplicacion, AplicacionProducto, CatalogoProducto, Rancho, Profile } from '@/types/database.types'
import { formatFenologia } from '@/lib/fenologia'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'

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
  /** Capturada sin conexión y aún sin subir: imprime "Pendiente de sincronizar" en el pie */
  pendienteSync?: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const val = (v: string | number | null | undefined, fallback = '—') =>
  v != null && v !== '' ? String(v) : fallback

const valNum = (v: number | null | undefined, fallback = '—') =>
  v != null ? parseFloat(v.toFixed(4)).toString() : fallback

// ── Constantes ───────────────────────────────────────────────────────────────

const PRODUCT_COLS: ColumnaDato[] = [
  { texto: 'Justificación / Plaga', ancho: 82, align: 'left' },
  { texto: 'Nivel infestación', ancho: 44, align: 'center' },
  { texto: 'Nombre Comercial', ancho: 98, align: 'left' },
  { texto: 'Ingrediente Activo', ancho: 93, align: 'left' },
  { texto: 'Dosis/ha', ancho: 46, align: 'center' },
  { texto: 'Dosis/barril (200L)', ancho: 62, align: 'center' },
  { texto: 'Dosis total', ancho: 55, align: 'center' },
  { texto: 'Días cosecha', ancho: 44, align: 'center' },
  { texto: 'Re-entrada (hrs)', ancho: 40, align: 'center' },
  { texto: 'RSCO/COFEPRIS', ancho: 96, align: 'left' },
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
  pendienteSync,
}: AplicacionPDFProps) {
  const productorNombre = operario.nombre_completo || operarioEmail || '—'
  const folio = ap.id.slice(0, 8).toUpperCase()
  const emision = fechaEmisionHoy()
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
      <PaginaEstandar
        titulo="REGISTRO DE APLICACIONES FOLIARES DE AGROQUÍMICOS"
        subtitulo={`Formato operativo | ${rancho.nombre}`}
        codigoFmt={codigoFmt}
        folio={folio}
        emision={emision}
        pendienteSync={pendienteSync}
        tituloDatos="1. DATOS DEL PRODUCTOR Y PARCELA"
        camposDatos={[
          { icono: 'usuario', etiqueta: 'Productor', valor: productorNombre },
          { icono: 'ubicacion', etiqueta: labelSitio, valor: val(rancho.nombre) },
          { etiqueta: 'Cultivo', valor: val(rancho.cultivo) },
          { etiqueta: 'Variedad', valor: val(ap.variedad) },
          { icono: 'codigo', etiqueta: 'Código de huerto', valor: val(rancho.codigo) },
          { etiqueta: 'Sector', valor: val(ap.sector) },
          { etiqueta: 'Superficie (ha)', valor: val(ap.superficie_ha) },
          { etiqueta: 'Etapa fenológica', valor: formatFenologia(ap.fenologia ?? undefined) },
        ]}
      >
        <Seccion titulo="2. FECHAS, HORARIOS Y CONDICIONES DE APLICACIÓN">
          <FranjaDatos
            campos={[
              { icono: 'calendario', etiqueta: 'Fecha recomendación asesor', valor: val(ap.fecha_recomendacion ? fechaPdf(ap.fecha_recomendacion) : null) },
              { icono: 'calendario', etiqueta: 'Fecha real de aplicación', valor: val(ap.fecha_aplicacion ? fechaPdf(ap.fecha_aplicacion) : null) },
              { etiqueta: 'Hora inicio', valor: val(ap.hora_inicio) },
              { etiqueta: 'Hora fin', valor: val(ap.hora_fin) },
              { etiqueta: 'Tipo de aplicación', valor: val(ap.tipo_aplicacion) },
              { etiqueta: 'Total agua usada (L)', valor: val(ap.total_agua_l) },
              { etiqueta: 'Equipo de aplicación', valor: val(ap.equipo) },
              { etiqueta: 'Condición meteorológica', valor: val(ap.condicion_meteorologica) },
              {
                etiqueta: 'Cloración',
                valor: ap.cloracion ? `Si — ${valNum(ap.cloro_cantidad_l)} ml · pH ${val(ap.cloro_ph)}` : 'No',
              },
            ]}
          />
        </Seccion>

        <Seccion titulo="3. PRODUCTOS APLICADOS">
          <TablaDatos
            columnas={PRODUCT_COLS}
            vacio="Sin productos registrados"
            filas={productos.map((p) => [
              val(p.plaga_objetivo),
              val(p.nivel_infestacion),
              val(p.catalogo_productos.nombre_comercial),
              val(p.catalogo_productos.ingrediente_activo),
              valNum(p.dosis_ha),
              valNum(p.dosis_200l),
              valNum(p.total_producto),
              val(p.dias_cosecha),
              val(p.reentrada_hrs),
              val(p.catalogo_productos.rsco),
            ])}
          />
        </Seccion>

        <Seccion titulo="4. EQUIPO DE PROTECCIÓN PERSONAL (EPP)">
          <Checklist items={EPP_ITEMS.map(({ key, label }) => ({ label, checked: Boolean(ap[key]) }))} />
        </Seccion>

        <Seccion titulo="5. CALDOS SOBRANTES">
          <FranjaDatos
            campos={[
              { etiqueta: '¿Hubo caldos sobrantes?', valor: ap.caldos_sobrantes ? 'Si' : 'No' },
              ...(ap.caldos_sobrantes
                ? [
                    { etiqueta: 'Cantidad (L)', valor: val(ap.caldos_cantidad_l) },
                    { etiqueta: 'Agua de lavado (L)', valor: val(ap.caldos_agua_lavado_l) },
                    {
                      etiqueta: '¿Eliminado en área designada?',
                      valor: ap.caldos_area_designada === true ? 'Si' : ap.caldos_area_designada === false ? 'No' : '—',
                    },
                  ]
                : []),
            ]}
          />
        </Seccion>

        {tieneObservaciones && (
          <Seccion titulo="6. OBSERVACIONES">
            <FranjaDatos campos={[{ etiqueta: '', valor: ap.observaciones ?? '' }]} />
          </Seccion>
        )}

        <View wrap={false}>
          <Seccion titulo={`${numFirmas}. FIRMAS Y RESPONSABLES`}>
            <PdfFirmas
              signatures={[
                { label: 'Nombre(s) del aplicador', nombre: val(ap.aplicadores), caption: 'Firma del aplicador' },
                { label: 'Asesor técnico', nombre: val(asesor?.nombre_completo), caption: 'Firma del asesor técnico' },
                { label: 'Responsable de inocuidad', nombre: val(responsable?.nombre_completo), caption: 'Firma del responsable de inocuidad' },
              ]}
            />
          </Seccion>
        </View>
      </PaginaEstandar>
    </Document>
  )
}
