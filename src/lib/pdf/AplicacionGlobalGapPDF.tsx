import { Document, View } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { Checklist } from '@/lib/pdf/disenoNuevo/Checklist'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import type { AplicacionPDFProps } from './AplicacionPDF'
import { formatFenologia } from '@/lib/fenologia'

// ── Helpers ──────────────────────────────────────────────────────────────────

const val = (v: string | number | null | undefined, fallback = '—') =>
  v != null && v !== '' ? String(v) : fallback

const valNum = (v: number | null | undefined, fallback = '—') =>
  v != null ? parseFloat(v.toFixed(4)).toString() : fallback

// ── Columnas de productos GlobalG.A.P. ───────────────────────────────────────

const PRODUCT_COLS_GG: ColumnaDato[] = [
  { texto: 'Justificacion / Plaga', ancho: 100, align: 'left' },
  { texto: 'Nombre Comercial', ancho: 110, align: 'left' },
  { texto: 'Ingrediente Activo', ancho: 110, align: 'left' },
  { texto: 'No. RSCO/COFEPRIS', ancho: 90, align: 'left' },
  { texto: 'Dosis por 200 L', ancho: 70, align: 'center' },
  { texto: 'Cantidad total', ancho: 70, align: 'center' },
  { texto: 'Int. Seguridad días', ancho: 60, align: 'center' },
  { texto: 'Reentrada hrs', ancho: 50, align: 'center' },
]

export function AplicacionGlobalGapPDF({
  aplicacion: ap,
  productos,
  rancho,
  asesor,
  responsable,
  operario,
  operarioEmail,
  pendienteSync,
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
      <PaginaEstandar
        titulo="APLICACIONES FOLIARES Y DE PLAGUICIDAS"
        subtitulo={`REG-21 · GlobalG.A.P. v6 | ${rancho.nombre}`}
        codigoFmt="GG-REG-21"
        folio={folio}
        emision={emision}
        pendienteSync={pendienteSync}
        tituloDatos="1. DATOS DE COMPAÑIA Y RANCHO"
        camposDatos={[
          { icono: 'usuario', etiqueta: 'Productor', valor: productorNombre },
          { icono: 'ubicacion', etiqueta: 'Rancho / Huerto', valor: val(rancho.nombre) },
          { etiqueta: 'Cultivo', valor: val(rancho.cultivo) },
          { icono: 'codigo', etiqueta: 'Código de huerto', valor: val(rancho.codigo) },
          { etiqueta: 'Variedad', valor: val(ap.variedad) },
          { etiqueta: 'Etapa fenológica', valor: formatFenologia(ap.fenologia ?? undefined) },
          { icono: 'calendario', etiqueta: 'Fecha de aplicación', valor: val(ap.fecha_aplicacion) },
          { icono: 'calendario', etiqueta: 'Próxima cosecha', valor: val((ap as any).proxima_cosecha) },
          { etiqueta: 'Hora inicio', valor: val(ap.hora_inicio) },
          { etiqueta: 'Hora fin', valor: val(ap.hora_fin) },
        ]}
      >
        <Seccion titulo="2. MÉTODO DE APLICACIÓN Y CONDICIONES">
          <FranjaDatos
            campos={[
              { etiqueta: 'Método de aplicación', valor: val((ap as any).metodo_aplicacion_gg) },
              { etiqueta: 'Equipo utilizado', valor: val(ap.equipo) },
              { etiqueta: 'Total agua usada (L)', valor: val(ap.total_agua_l) },
              { etiqueta: 'Condición climatica', valor: val(ap.condicion_meteorologica) },
              {
                etiqueta: 'Cloración',
                valor: ap.cloracion ? `Si — ${valNum(ap.cloro_cantidad_l)} ml · pH ${val(ap.cloro_ph)}` : 'No',
              },
            ]}
          />
        </Seccion>

        <Seccion titulo="3. EQUIPO DE PROTECCIÓN PERSONAL (EPP) — GlobalG.A.P. REG-21">
          <Checklist
            items={[
              { label: 'Traje protector', checked: Boolean(ap.epp_traje) },
              { label: 'Mascarilla', checked: Boolean(ap.epp_mascarillas) },
              { label: 'Botas / Lentes', checked: Boolean(ap.epp_botas) || Boolean(ap.epp_googles) },
              { label: 'Guantes de nitrilo', checked: Boolean(ap.epp_guantes) },
            ]}
          />
        </Seccion>

        <Seccion titulo="4. PRODUCTOS APLICADOS">
          <TablaDatos
            columnas={PRODUCT_COLS_GG}
            vacio="Sin productos registrados"
            filas={productos.map((p) => [
              val(p.plaga_objetivo),
              val(p.catalogo_productos.nombre_comercial),
              val(p.catalogo_productos.ingrediente_activo),
              val(p.catalogo_productos.rsco),
              valNum(p.dosis_200l),
              valNum(p.total_producto),
              val(p.dias_cosecha),
              val(p.reentrada_hrs),
            ])}
          />
        </Seccion>

        <Seccion titulo="5. APLICADORES Y RESPONSABLES">
          <FranjaDatos campos={[{ etiqueta: 'Aplicador(es)', valor: val(ap.aplicadores) }]} />
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
