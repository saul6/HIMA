// PATRÓN INOCUIDAD — PDF M46 (diseño nuevo: lib/pdf/disenoNuevo)
// Bitácora de Rondines de Vigilancia — A4 vertical, tabla de rondas por área.

import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { TablaDatos, ANCHO_UTIL, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface M46ItemPDF {
  id: string
  area: string
  nombre: string
}

export interface M46RondaPDF {
  numero: number
  hora: string | null
}

export interface M46ResultadoPDF {
  item_id: string
  ronda: number
  valor: 'sin_novedad' | 'con_novedad'
}

interface Props {
  rancho: string
  fecha: string
  turno: string | null
  vigilante: string
  jefe_seguridad: string | null
  observaciones: string | null
  items: M46ItemPDF[]
  rondas: M46RondaPDF[]
  resultados: M46ResultadoPDF[]
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFecha(f: string): string {
  try {
    const [y, m, d] = f.split('-')
    return `${d}/${m}/${y}`
  } catch { return f }
}

// ── RondinesVigilanciaPDF ─────────────────────────────────────────────────────

export function RondinesVigilanciaPDF({
  rancho, fecha, turno, vigilante, jefe_seguridad, observaciones,
  items, rondas, resultados, codigoClave, terminoSitio = 'Instalación',
  firmaRealizo, firmaVerifico,
}: Props) {
  const emision   = new Date().toLocaleDateString('es-MX')
  const codigoFmt = codigoFormato('F-FRUS-ADM-07', codigoClave)

  const areas = Array.from(new Set(items.map((i) => i.area)))

  const resMap: Record<string, string> = {}
  for (const r of resultados) {
    resMap[`${r.item_id}|${r.ronda}`] = r.valor
  }

  const horaMap: Record<number, string> = {}
  for (const r of rondas) {
    horaMap[r.numero] = r.hora ?? '—'
  }

  const RONDAS = [1, 2, 3, 4]

  const columnas: ColumnaDato[] = [
    { texto: 'Área / Punto de supervisión', ancho: 220 },
    ...RONDAS.map((n): ColumnaDato => ({ texto: `Ronda ${n}\n${horaMap[n] ?? '—'}`, ancho: 85, align: 'center' })),
  ]

  const filas = areas.flatMap((area) => [
    { banda: area },
    ...items.filter((i) => i.area === area).map((item) => [
      item.nombre,
      ...RONDAS.map((n) => {
        const esNovedad = (resMap[`${item.id}|${n}`] ?? 'sin_novedad') === 'con_novedad'
        return esNovedad ? { texto: 'Con novedad', color: PC.negativo, negrita: true } : 'Sin novedad'
      }),
    ]),
  ])

  return (
    <Document
      title={`Rondines de Vigilancia — ${rancho} ${fmtFecha(fecha)}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
    >
      <PaginaEstandar
        orientacion="portrait"
        titulo="BITÁCORA DE RONDINES DE VIGILANCIA"
        subtitulo={`Rondines | ${rancho} | ${fmtFecha(fecha)}`}
        codigoFmt={codigoFmt}
        folio={fmtFecha(fecha)}
        emision={emision}
        tituloDatos="1. DATOS DEL SITIO"
        camposDatos={[
          { icono: 'ubicacion', etiqueta: terminoSitio, valor: rancho },
          { icono: 'calendario', etiqueta: 'Fecha', valor: fmtFecha(fecha) },
          { etiqueta: 'Turno', valor: turno ?? '—' },
          { icono: 'usuario', etiqueta: 'Vigilante', valor: vigilante },
          { icono: 'usuario', etiqueta: 'Jefe de Seguridad', valor: jefe_seguridad ?? '—' },
        ]}
      >
        <Seccion titulo="2. RONDINES DE VIGILANCIA">
          <TablaDatos columnas={columnas} anchoTotal={ANCHO_UTIL.portrait} fuente={6.5} fuenteEnc={6.5} filas={filas} />
        </Seccion>

        {observaciones ? <FranjaDatos campos={[{ etiqueta: 'Observaciones', valor: observaciones }]} /> : null}

        <Seccion titulo="3. FIRMAS Y RESPONSABLES">
          <PdfFirmas
            signatures={[
              { label: '', nombre: '', caption: 'Firma del vigilante', firma: firmaRealizo ?? null },
              { label: '', nombre: '', caption: 'Jefe de Seguridad', firma: firmaVerifico ?? null },
            ]}
          />
        </Seccion>
      </PaginaEstandar>
    </Document>
  )
}
