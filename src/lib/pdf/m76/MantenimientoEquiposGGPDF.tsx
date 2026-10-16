// PDF M76 — Verificación y mantenimiento de equipos de aplicación GlobalGAP, REG-09 (diseño nuevo).
import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { Checklist } from '@/lib/pdf/disenoNuevo/Checklist'
import { TablaDatos, ANCHO_UTIL, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
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

type CheckVal = 'si' | 'no' | 'na'

const TIPO_LABELS: Record<string, string> = {
  verificacion: 'Verificación',
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

// La "X" marca la respuesta elegida (Si / No / N/A); no es un valor negativo
const marca = (v: boolean) => (v ? { texto: 'X', color: PC.m13Navy, negrita: true } : '')

const COLS_CHECK: ColumnaDato[] = [
  { texto: 'Componente', ancho: 345 },
  { texto: 'Si', ancho: 70, align: 'center' },
  { texto: 'No', ancho: 70, align: 'center' },
  { texto: 'N/A', ancho: 70, align: 'center' },
]

export function MantenimientoEquiposGGPagina({ fila, orgNombre, firmaRealizo }: MantenimientoEquiposGGPDFProps) {
  return (
    <PaginaEstandar
      orientacion="portrait"
      titulo="VERIFICACION Y MANTENIMIENTO DE EQUIPOS DE APLICACION"
      subtitulo={`REG-09 · GlobalGAP | ${fila.rancho}`}
      codigoFmt="REG-09"
      folio={fila.fecha}
      emision={fila.fecha}
      etiquetaEmision="Fecha"
      tituloDatos="DATOS GENERALES"
      camposDatos={[
        ...(orgNombre ? [{ icono: 'usuario' as const, etiqueta: 'Empresa', valor: orgNombre }] : []),
        { icono: 'ubicacion', etiqueta: 'Rancho / instalacion', valor: fila.rancho },
        { icono: 'calendario', etiqueta: 'Fecha', valor: formatFecha(fila.fecha) },
        { etiqueta: 'Equipo', valor: fila.equipo ?? '—' },
        { icono: 'usuario', etiqueta: 'Realizo', valor: fila.realizo ?? '—' },
      ]}
    >
      <Seccion titulo="TIPO DE ACTIVIDAD">
        <Checklist
          items={(['verificacion', 'preventivo', 'correctivo'] as const).map((t) => ({ label: TIPO_LABELS[t], checked: fila.tipo_actividad === t }))}
        />
      </Seccion>

      <Seccion titulo="ESTADO DE COMPONENTES">
        <TablaDatos
          columnas={COLS_CHECK}
          anchoTotal={ANCHO_UTIL.portrait}
          sinNegativos
          filas={CHECK_LABELS.map(({ key, label }) => {
            const val = (fila[key] as CheckVal | null) ?? 'si'
            return [label, marca(val === 'si'), marca(val === 'no'), marca(val === 'na')]
          })}
        />
      </Seccion>

      {fila.descripcion_trabajo && <FranjaDatos campos={[{ etiqueta: 'Descripción del trabajo', valor: fila.descripcion_trabajo }]} />}
      {fila.observaciones && <FranjaDatos campos={[{ etiqueta: 'Observaciones', valor: fila.observaciones }]} />}

      <PdfFirmas signatures={[{ label: '', nombre: '', caption: 'Nombre y firma de quien realiza', firma: firmaRealizo ?? null }]} />
    </PaginaEstandar>
  )
}

export function MantenimientoEquiposGGPDF(props: MantenimientoEquiposGGPDFProps) {
  return (
    <Document>
      <MantenimientoEquiposGGPagina {...props} />
    </Document>
  )
}

// Anchos relativos de columna del consolidado (horizontal)
const COLS_CONSOLIDADO: ColumnaDato[] = [
  { texto: 'Fecha', ancho: 60, align: 'center' },
  { texto: 'Rancho', ancho: 90 },
  { texto: 'Equipo', ancho: 80 },
  { texto: 'Actividad', ancho: 62, align: 'center' },
  { texto: 'Fugas', ancho: 45, align: 'center' },
  { texto: 'Mang.', ancho: 45, align: 'center' },
  { texto: 'Pistola', ancho: 45, align: 'center' },
  { texto: 'Lanzas', ancho: 45, align: 'center' },
  { texto: 'Boq.', ancho: 45, align: 'center' },
  { texto: 'Realizo', ancho: 88 },
  { texto: 'Descripcion', ancho: 91 },
]

const CHECK_COLS: (keyof MantenimientoEquiposGGFilaPDF)[] = ['fugas_tanque_bomba', 'mangueras', 'pistola', 'lanzas', 'boquillas']

export function MantenimientoEquiposGGConsolidadoPDF({ filas, orgNombre }: {
  filas: MantenimientoEquiposGGFilaPDF[]
  orgNombre?: string | null
}) {
  function formatFechaCorta(iso: string) {
    try { return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) }
    catch { return iso }
  }

  return (
    <Document>
      <PaginaEstandar
        titulo="VERIFICACION Y MANTENIMIENTO DE EQUIPOS — CONSOLIDADO"
        subtitulo={orgNombre ? `GlobalGAP | ${orgNombre}` : 'GlobalGAP'}
        codigoFmt="REG-09"
        folio="Consolidado"
        emision={filas[0]?.fecha ?? ''}
        etiquetaEmision="Fecha"
        camposDatos={[]}
      >
        <TablaDatos
          columnas={COLS_CONSOLIDADO}
          fuente={7}
          fuenteEnc={6.5}
          filas={filas.map((f) => [
            formatFechaCorta(f.fecha),
            f.rancho,
            f.equipo ?? '—',
            f.tipo_actividad ? (TIPO_LABELS[f.tipo_actividad] ?? f.tipo_actividad) : '—',
            ...CHECK_COLS.map((key) => {
              const val = (f[key] as string | null) ?? '—'
              return val.toUpperCase() === 'SI' ? 'Si' : val.toUpperCase() === 'NO' ? 'No' : 'N/A'
            }),
            f.realizo ?? '—',
            f.descripcion_trabajo ?? '',
          ])}
        />
      </PaginaEstandar>
    </Document>
  )
}
