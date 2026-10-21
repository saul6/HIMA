// PATRÓN INOCUIDAD — PDF M47 (diseño nuevo: lib/pdf/disenoNuevo)
// Registro de Personal — A4 horizontal, tabla de trabajadores con 3 grupos de columnas.

import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion, fechaEmisionHoy } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { Leyenda } from '@/lib/pdf/disenoNuevo/Leyenda'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface M47ItemPDF {
  id: string
  nombre: string
}

export interface M47TrabajadorPDF {
  numero: number
  puesto: string | null
  nombre: string
  direccion: string | null
  telefono_casa: string | null
  celular: string | null
  fecha_nacimiento: string | null
  emergencia_nombre: string | null
  emergencia_parentesco: string | null
  emergencia_telefono: string | null
  observaciones: string | null
  checklist: Record<string, boolean>
}

export interface RegistroPersonalPDFProps {
  orgNombre: string
  rancho: string
  fechaPDF: string
  trabajadores: M47TrabajadorPDF[]
  documentos: M47ItemPDF[]
  capacitaciones: M47ItemPDF[]
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const t = (v: string | null | undefined): string => v ?? '—'

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  try {
    const [, m, d] = iso.split('-')
    const y = iso.slice(0, 4)
    return `${d}/${m}/${y}`
  } catch { return iso }
}

function fmtFechaCorta(iso: string): string {
  return fechaPdf(iso)
}

// ── Anchos de columna (relativos; la tabla se escala al ancho útil de la hoja) ─

const COL_NO     = 16
const COL_PUESTO = 42
const COL_NOMBRE = 78
const COL_DIR    = 60
const COL_TCASA  = 36
const COL_CEL    = 36
const COL_FNAC   = 42
const COL_EM_NOM = 58
const COL_EM_PAR = 36
const COL_EM_TEL = 36
const COL_ITEM   = 20

// ── RegistroPersonalPDF ───────────────────────────────────────────────────────

export function RegistroPersonalPDF({
  orgNombre, rancho, fechaPDF, trabajadores, documentos, capacitaciones,
  codigoClave, terminoSitio = 'Instalación', firmaRealizo, firmaVerifico,
}: RegistroPersonalPDFProps) {
  const emision   = fechaEmisionHoy()
  const codigoFmt = codigoFormato('F-FRUS-ADM-04', codigoClave)

  const nDocs = documentos.length
  const nCaps = capacitaciones.length

  const wDocs     = nDocs * COL_ITEM
  const wCaps     = nCaps * COL_ITEM
  const fixedTotal = COL_NO + COL_PUESTO + COL_NOMBRE + COL_DIR + COL_TCASA + COL_CEL + COL_FNAC
    + COL_EM_NOM + COL_EM_PAR + COL_EM_TEL + wDocs + wCaps
  const COL_OBS   = Math.max(40, 801 - fixedTotal)

  const columnas: ColumnaDato[] = [
    { texto: 'No.', ancho: COL_NO, align: 'center' },
    { texto: 'Puesto', ancho: COL_PUESTO },
    { texto: 'Nombre', ancho: COL_NOMBRE },
    { texto: 'Dirección', ancho: COL_DIR },
    { texto: 'Tel. Casa', ancho: COL_TCASA },
    { texto: 'Celular', ancho: COL_CEL },
    { texto: 'F. Nac. D/M/A', ancho: COL_FNAC, align: 'center' },
    { texto: 'Nombre', ancho: COL_EM_NOM },
    { texto: 'Parentesco', ancho: COL_EM_PAR },
    { texto: 'Teléfono', ancho: COL_EM_TEL },
    ...documentos.map((_, i): ColumnaDato => ({ texto: `D${i + 1}`, ancho: COL_ITEM, align: 'center' })),
    ...capacitaciones.map((_, i): ColumnaDato => ({ texto: `C${i + 1}`, ancho: COL_ITEM, align: 'center' })),
    { texto: 'Observaciones', ancho: COL_OBS },
  ]

  const grupos = [
    { texto: '', ancho: COL_NO },
    { texto: 'Datos personales del trabajador', ancho: COL_PUESTO + COL_NOMBRE + COL_DIR + COL_TCASA + COL_CEL + COL_FNAC },
    { texto: 'Contacto de emergencia', ancho: COL_EM_NOM + COL_EM_PAR + COL_EM_TEL },
    ...(nDocs > 0 ? [{ texto: 'Documentación personal', ancho: wDocs }] : []),
    ...(nCaps > 0 ? [{ texto: 'Capacitaciones', ancho: wCaps }] : []),
    { texto: 'Observaciones', ancho: COL_OBS },
  ]

  // Leyenda D1..Dn + C1..Cn
  const legendEntradas = []
  if (nDocs > 0) {
    legendEntradas.push({
      titulo: 'Documentación',
      items: documentos.map((d, i) => ({ codigo: `D${i + 1}`, label: d.nombre })),
    })
  }
  if (nCaps > 0) {
    legendEntradas.push({
      titulo: 'Capacitaciones',
      items: capacitaciones.map((c, i) => ({ codigo: `C${i + 1}`, label: c.nombre })),
    })
  }

  return (
    <Document
      title={`Registro de Personal — ${rancho} ${fmtFechaCorta(fechaPDF)}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
    >
      <PaginaEstandar
        titulo="REGISTRO DE PERSONAL"
        subtitulo={`Personal | ${rancho}`}
        codigoFmt={codigoFmt}
        folio={fmtFechaCorta(fechaPDF)}
        emision={emision}
        tituloDatos="1. DATOS DEL SITIO"
        camposDatos={[
          { icono: 'ubicacion', etiqueta: terminoSitio, valor: rancho },
          { icono: 'usuario', etiqueta: 'Organización', valor: orgNombre },
          { icono: 'calendario', etiqueta: 'Fecha', valor: fmtFechaCorta(fechaPDF) },
        ]}
      >
        <Seccion titulo="2. REGISTRO DE TRABAJADORES">
          <TablaDatos
            columnas={columnas}
            encabezadoSuperior={grupos}
            fuente={6}
            fuenteEnc={5.5}
            filas={trabajadores.map((w) => [
              String(w.numero),
              t(w.puesto),
              { texto: w.nombre, negrita: true },
              t(w.direccion),
              t(w.telefono_casa),
              t(w.celular),
              fmtFecha(w.fecha_nacimiento),
              t(w.emergencia_nombre),
              t(w.emergencia_parentesco),
              t(w.emergencia_telefono),
              ...documentos.map((d) => (w.checklist[d.id] ? 'Si' : '')),
              ...capacitaciones.map((c) => (w.checklist[c.id] ? 'Si' : '')),
              t(w.observaciones),
            ])}
          />
        </Seccion>

        {legendEntradas.length > 0 && <Leyenda entradas={legendEntradas} />}

        <Seccion titulo="3. FIRMAS Y RESPONSABLES">
          <PdfFirmas
            signatures={[
              { label: '', nombre: '', caption: 'Responsable de Recursos Humanos', firma: firmaRealizo ?? null },
              { label: '', nombre: '', caption: 'Jefe de la instalación', firma: firmaVerifico ?? null },
            ]}
          />
        </Seccion>
      </PaginaEstandar>
    </Document>
  )
}
