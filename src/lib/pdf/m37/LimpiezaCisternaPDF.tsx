// PATRÓN INOCUIDAD — PDF M37 (plantilla homogénea M.A.D.Y)
// Bitácora de limpieza y cloración de la cisterna — A4 landscape, matriz mensual.
// TopBar + PdfHeader + PdfSectionBanner + matriz inline (OK/No/N/A + Sin plaga/Con plaga) + franja cloro cisterna/desinfección + PdfFooter.

import { Document } from '@react-pdf/renderer'
import { PaginaBitacoraMensual, mesNombre } from '@/lib/pdf/disenoNuevo/PaginaBitacoraMensual'
import type { ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ValorM37PDF = 'hecho' | 'no_hecho' | 'na'

export interface M37ItemPDF { id: string; nombre: string; frecuencia: string; es_inspeccion_plaga: boolean }

export interface M37DiaDataPDF {
  cloro_cisterna: number | null
  ajuste_cloro_cisterna: string | null
  cloro_desinfeccion: number | null
  ajuste_cloro_desinfeccion: string | null
  realizo: string | null
  aprobo: string | null
}

export interface LimpiezaCisternaPaginaProps {
  instalacion: string
  instalacionCodigo: string
  anio: number
  mes: number
  items: M37ItemPDF[]
  resultados: Record<number, Record<string, ValorM37PDF>>
  diasData: Record<number, M37DiaDataPDF>
  observaciones: string | null
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface LimpiezaCisternaConsolidadoProps {
  paginas: LimpiezaCisternaPaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── Registro diario de cloración y personal ───────────────────────────────────

const COLS_DIA: ColumnaDato[] = [
  { texto: 'Dia', ancho: 20, align: 'center' },
  { texto: 'Cloro cisterna (1.5-3.0 ppm)', ancho: 65, align: 'center' },
  { texto: 'Ajuste cloro cisterna', ancho: 60, align: 'center' },
  { texto: 'Cloro desinfección (100-200 ppm)', ancho: 65, align: 'center' },
  { texto: 'Ajuste cloro desinfección', ancho: 60, align: 'center' },
  { texto: 'Realizó', ancho: 95, align: 'center' },
  { texto: 'Aprobo', ancho: 95, align: 'center' },
]

// ── LimpiezaCisternaPagina ────────────────────────────────────────────────────

export function LimpiezaCisternaPagina({
  instalacion, instalacionCodigo, anio, mes, items, resultados, diasData,
  observaciones, codigoClave, terminoSitio = 'Instalación', firmaRealizo, firmaVerifico,
}: LimpiezaCisternaPaginaProps) {
  const dias = Object.keys(diasData).map(Number).filter((dia) => {
    const d = diasData[dia]
    return d.cloro_cisterna != null || d.ajuste_cloro_cisterna || d.cloro_desinfeccion != null || d.ajuste_cloro_desinfeccion || d.realizo || d.aprobo
  }).sort((a, b) => a - b)

  return (
    <PaginaBitacoraMensual
      titulo="BITÁCORA DE LIMPIEZA Y CLORACIÓN DE LA CISTERNA"
      codigoFmt={codigoFormato('F-FRUS-SAN-15', codigoClave)}
      instalacion={instalacion}
      instalacionCodigo={instalacionCodigo}
      terminoSitio={terminoSitio}
      anio={anio}
      mes={mes}
      area="Cisterna"
      items={items}
      resultados={resultados}
      diasData={{}}
      conConcentraciones={false}
      registroDiario={{
        titulo: 'REGISTRO DIARIO DE CLORACIÓN Y PERSONAL',
        columnas: COLS_DIA,
        filas: dias.map((dia) => {
          const d = diasData[dia]
          return [
            String(dia),
            d.cloro_cisterna != null ? String(d.cloro_cisterna) : '',
            d.ajuste_cloro_cisterna ?? '',
            d.cloro_desinfeccion != null ? String(d.cloro_desinfeccion) : '',
            d.ajuste_cloro_desinfeccion ?? '',
            d.realizo ?? '',
            d.aprobo ?? '',
          ]
        }),
      }}
      formatoValor={(v, item) =>
        item.es_inspeccion_plaga
          ? v === 'na' ? { texto: 'Sin plaga', tono: 'ok' } : v === 'hecho' ? { texto: 'Con plaga', tono: 'mal' } : { texto: '', tono: 'neutro' }
          : null
      }
      observaciones={observaciones}
      nota="Nota: Cloro cisterna recomendado 1.5-3.0 ppm. Cloro desinfección de superficies recomendado 100-200 ppm. Ajuste si la concentración está fuera del rango. En caso de hallazgo de plaga se registra incidencia en M13."
      notaDespuesDeObs
      firmaRealizo={firmaRealizo}
      firmaVerifico={firmaVerifico}
    />
  )
}

export function LimpiezaCisternaPDF(props: LimpiezaCisternaPaginaProps) {
  return (
    <Document
      title={`Limpieza Cisterna ${mesNombre(props.anio, props.mes)}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Bitácora de Limpieza y Cloración de la Cisterna — ${props.instalacion}`}
      keywords="MADY, inocuidad, limpieza, cisterna, cloracion"
    >
      <LimpiezaCisternaPagina {...props} />
    </Document>
  )
}

export function LimpiezaCisternaConsolidadoPDF({ paginas }: LimpiezaCisternaConsolidadoProps) {
  return (
    <Document
      title="Limpieza Cisterna Consolidado"
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Bitácora de Limpieza y Cloración de la Cisterna — Consolidado"
      keywords="MADY, inocuidad, limpieza, cisterna, cloracion, consolidado"
    >
      {paginas.map((p, i) => <LimpiezaCisternaPagina key={i} {...p} />)}
    </Document>
  )
}
