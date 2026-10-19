// PDF M20 — Registro de Accidentes Laborales (Cuarto Frio)
// Formato F-FRUS-CAL-15 Rev 01. A4 portrait. Helvetica. Plantilla homogénea M.A.D.Y.
// No Unicode: checklist (X) / ( ). Dos firmas en blanco.

import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { Checklist } from '@/lib/pdf/disenoNuevo/Checklist'
import { SiNoTexto } from '@/lib/pdf/disenoNuevo/SiNoTexto'
import { Fotos } from '@/lib/pdf/disenoNuevo/Fotos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

// ── Constantes ────────────────────────────────────────────────────────────────

export const ATENCIONES_OPCIONES = [
  'Ninguna',
  'Curación',
  'Primeros auxilios',
  'Atención de paramédicos',
  'Atención médica',
  'Hospitalización',
]

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AccidenteLaboralPaginaProps {
  folio: string
  instalacion: string
  instalacionCodigo: string
  fecha: string                   // YYYY-MM-DD
  trabajadorNombre: string
  descripcionIncidente: string
  atencionRecibida: string[]      // etiquetas como vienen del DB (con acentos)
  requirioIncapacidad: boolean
  incapacidadMotivo: string | null
  codigoClave: string
  requirioLimpieza: boolean
  limpiezaDescripcion: string | null
  productoInvolucrado: boolean
  disposicionProducto: string | null
  dataUris: string[]              // data URIs base64, puede ser vacío
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface AccidenteLaboralConsolidadoPDFProps {
  registros: AccidenteLaboralPaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFechaPDF(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch { return iso }
}

// Normaliza la cadena para comparar sin acentos/tildes
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function estaSeleccionada(opcion: string, seleccionadas: string[]): boolean {
  const n = normalizar(opcion)
  return seleccionadas.some((s) => normalizar(s) === n)
}

// ── Componente de página ──────────────────────────────────────────────────────

export function AccidenteLaboralPagina({
  folio,
  instalacion,
  instalacionCodigo,
  fecha,
  trabajadorNombre,
  descripcionIncidente,
  atencionRecibida,
  requirioIncapacidad,
  incapacidadMotivo,
  codigoClave,
  requirioLimpieza,
  limpiezaDescripcion,
  productoInvolucrado,
  disposicionProducto,
  dataUris,
  terminoSitio = 'Instalación',
  firmaRealizo,
  firmaVerifico,
}: AccidenteLaboralPaginaProps) {
  const emision   = new Date().toLocaleDateString('es-MX')
  const codigoFmt = codigoFormato('F-FRUS-CAL-15', codigoClave)

  return (
    <PaginaEstandar
      orientacion="portrait"
      titulo="REGISTRO DE ACCIDENTES LABORALES"
      subtitulo={`Accidente laboral | ${instalacion} | ${formatFechaPDF(fecha)}`}
      codigoFmt={codigoFmt}
      folio={folio}
      emision={emision}
      tituloDatos="1. DATOS GENERALES"
      camposDatos={[
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: instalacion || '—' },
        { icono: 'codigo', etiqueta: 'Código', valor: instalacionCodigo || '—' },
        { icono: 'calendario', etiqueta: 'Fecha del accidente', valor: formatFechaPDF(fecha) },
        { icono: 'usuario', etiqueta: 'Nombre del trabajador', valor: trabajadorNombre || '—' },
      ]}
    >
      <Seccion titulo="2. DESCRIPCIÓN DEL INCIDENTE">
        <FranjaDatos campos={[{ etiqueta: '', valor: descripcionIncidente || '—' }]} margenInferior={8} />
      </Seccion>

      <Seccion titulo="3. ATENCIÓN RECIBIDA">
        <Checklist items={ATENCIONES_OPCIONES.map((op) => ({ label: op, checked: estaSeleccionada(op, atencionRecibida) }))} />
      </Seccion>

      <Seccion titulo="4. REQUIRIÓ INCAPACIDAD">
        <SiNoTexto valor={requirioIncapacidad} texto={requirioIncapacidad && incapacidadMotivo ? incapacidadMotivo : ''} />
      </Seccion>

      <Seccion titulo="5. REQUIRIÓ LIMPIEZA DEL ÁREA">
        <SiNoTexto valor={requirioLimpieza} texto={requirioLimpieza && limpiezaDescripcion ? limpiezaDescripcion : ''} />
      </Seccion>

      <Seccion titulo="6. PRODUCTO INVOLUCRADO">
        <SiNoTexto valor={productoInvolucrado} texto={productoInvolucrado && disposicionProducto ? `Disposicion: ${disposicionProducto}` : ''} />
      </Seccion>

      {dataUris.length > 0 && (
        <Seccion titulo="7. EVIDENCIA FOTOGRÁFICA">
          <Fotos uris={dataUris} />
        </Seccion>
      )}

      <PdfFirmas
        signatures={[
          { label: '', nombre: '', caption: 'Firma del Jefe de Seguridad', firma: firmaRealizo ?? null },
          { label: '', nombre: '', caption: 'Firma del Jefe del Cooler', firma: firmaVerifico ?? null },
        ]}
      />
    </PaginaEstandar>
  )
}

// ── PDF individual ─────────────────────────────────────────────────────────────

export function AccidenteLaboralPDF(props: AccidenteLaboralPaginaProps) {
  return (
    <Document
      title={`Accidente Laboral ${props.instalacion} ${props.fecha}`}
      author="M.A.D.Y"
      subject="Registro de Accidentes Laborales"
    >
      <AccidenteLaboralPagina {...props} />
    </Document>
  )
}

// ── PDF consolidado ────────────────────────────────────────────────────────────

export function AccidenteLaboralConsolidadoPDF({
  registros,
  instalacionNombre,
  desde,
  hasta,
}: AccidenteLaboralConsolidadoPDFProps) {
  return (
    <Document
      title={`Accidentes Laborales Consolidado ${instalacionNombre} ${desde} ${hasta}`}
      author="M.A.D.Y"
      subject="Registro de Accidentes Laborales Consolidado"
    >
      {registros.map((r, i) => (
        <AccidenteLaboralPagina key={i} {...r} />
      ))}
    </Document>
  )
}
