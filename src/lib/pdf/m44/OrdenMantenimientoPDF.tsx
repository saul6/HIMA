// PDF M44 — Orden de Mantenimiento (Cuarto Frio)
// Formato F-FRUS-MTT-01. A4 portrait. Helvetica. Plantilla homogénea M.A.D.Y.
// No Unicode: checkboxes (X) / espacio. Dos firmas en blanco.

import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { Checklist } from '@/lib/pdf/disenoNuevo/Checklist'
import { SiNoTexto } from '@/lib/pdf/disenoNuevo/SiNoTexto'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type PrioridadM44PDF = 'inmediata' | 'turno' | 'siguientes_dias'

export interface OrdenMantenimientoPDFProps {
  organizacion: string
  instalacion: string
  instalacionCodigo: string
  fecha: string
  folio: string | null
  descripcion_solicitud: string | null
  prioridad: PrioridadM44PDF
  solicita: string | null
  recibe_mtto: string | null
  equipo_produccion: boolean
  lavado_sanitizado: boolean
  observaciones: string | null
  entrega_mtto: string | null
  recibe: string | null
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

// ── Constantes ────────────────────────────────────────────────────────────────

const PRIORIDAD_LABELS: Record<string, string> = {
  inmediata:       'Atención inmediata',
  turno:           'Atención durante el turno',
  siguientes_dias: 'Atención durante los siguientes días',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

// ── Componente principal ──────────────────────────────────────────────────────

export function OrdenMantenimientoPDF({
  organizacion, instalacion, instalacionCodigo, fecha, folio,
  descripcion_solicitud, prioridad, solicita, recibe_mtto,
  equipo_produccion, lavado_sanitizado, observaciones,
  entrega_mtto, recibe, codigoClave, terminoSitio = 'Instalación',
  firmaRealizo, firmaVerifico,
}: OrdenMantenimientoPDFProps) {
  const emision   = new Date().toLocaleDateString('es-MX')
  const codigoFmt = codigoFormato('F-FRUS-MTT-01', codigoClave)

  return (
    <Document
      title={`Orden de Mantenimiento ${instalacion} ${fecha}`}
      author="M.A.D.Y"
      subject="Orden de Mantenimiento"
    >
      <PaginaEstandar
        orientacion="portrait"
        titulo="ORDEN DE MANTENIMIENTO"
        subtitulo={`Orden de mantenimiento | ${instalacion}`}
        codigoFmt={codigoFmt}
        folio={folio ?? '—'}
        emision={emision}
        tituloDatos="DATOS GENERALES"
        camposDatos={[
          { icono: 'usuario', etiqueta: 'Organización', valor: organizacion || '—' },
          { icono: 'ubicacion', etiqueta: terminoSitio, valor: instalacion || '—' },
          { icono: 'codigo', etiqueta: 'Código', valor: instalacionCodigo || '—' },
          { icono: 'calendario', etiqueta: 'Fecha', valor: formatFecha(fecha) },
          { icono: 'folio', etiqueta: 'Folio', valor: folio ?? '—' },
        ]}
      >
        <Seccion titulo="DESCRIPCIÓN DE LA SOLICITUD">
          <FranjaDatos campos={[{ etiqueta: '', valor: descripcion_solicitud ?? '' }]} margenInferior={8} />
        </Seccion>

        <Seccion titulo="PRIORIDAD">
          <Checklist items={Object.entries(PRIORIDAD_LABELS).map(([id, label]) => ({ label, checked: prioridad === id }))} />
        </Seccion>

        <Seccion titulo="PERSONAL">
          <FranjaDatos
            campos={[
              { icono: 'usuario', etiqueta: 'Solicita', valor: solicita || '—' },
              { icono: 'usuario', etiqueta: 'Recibe en Mantenimiento', valor: recibe_mtto || '—' },
            ]}
          />
        </Seccion>

        <Seccion titulo="CONDICIONES DE ENTREGA">
          <SiNoTexto valor={equipo_produccion} texto={'¿Se reparó un equipo de producción?'} />
          <SiNoTexto fallaSiNo valor={lavado_sanitizado} texto={'¿El equipo fue lavado y sanitizado después de la reparacion?'} />
        </Seccion>

        {observaciones ? (
          <Seccion titulo="OBSERVACIONES">
            <FranjaDatos campos={[{ etiqueta: '', valor: observaciones }]} margenInferior={8} />
          </Seccion>
        ) : null}

        <PdfFirmas
          signatures={[
            { label: entrega_mtto ?? '', nombre: '', caption: 'Entrega en Mantenimiento', firma: firmaRealizo ?? null },
            { label: recibe ?? '', nombre: '', caption: 'Recibe', firma: firmaVerifico ?? null },
          ]}
        />
      </PaginaEstandar>
    </Document>
  )
}
