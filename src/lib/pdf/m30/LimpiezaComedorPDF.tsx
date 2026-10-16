// PATRÓN INOCUIDAD — PDF M30 (plantilla homogénea M.A.D.Y)
// Bitácora de limpieza del comedor — A4 landscape, matriz mensual (diseño nuevo: PaginaBitacoraMensual).

import { Document } from '@react-pdf/renderer'
import { PaginaBitacoraMensual, mesNombre } from '@/lib/pdf/disenoNuevo/PaginaBitacoraMensual'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ValorM30PDF = 'hecho' | 'no_hecho' | 'na'
export interface M30ItemPDF { id: string; nombre: string; frecuencia: string }
export interface M30DiaDataPDF {
  concentracion_cloro: number | null
  ajuste_cloro: string | null
  concentracion_acido: number | null
  ajuste_acido: string | null
  realizo: string | null
  aprobo: string | null
}
export interface LimpiezaComedorPaginaProps {
  instalacion: string
  instalacionCodigo: string
  anio: number
  mes: number
  items: M30ItemPDF[]
  resultados: Record<number, Record<string, ValorM30PDF>>
  diasData: Record<number, M30DiaDataPDF>
  observaciones: string | null
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}
export interface LimpiezaComedorConsolidadoProps {
  paginas: LimpiezaComedorPaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── LimpiezaComedorPagina ─────────────────────────────────────────────────

export function LimpiezaComedorPagina({
  instalacion, instalacionCodigo, anio, mes, items, resultados, diasData,
  observaciones, codigoClave, terminoSitio = 'Instalación', firmaRealizo, firmaVerifico,
}: LimpiezaComedorPaginaProps) {
  return (
    <PaginaBitacoraMensual
      titulo="BITÁCORA DE LIMPIEZA DEL COMEDOR"
      codigoFmt={codigoFormato('F-FRUS-SAN-08', codigoClave)}
      instalacion={instalacion}
      instalacionCodigo={instalacionCodigo}
      terminoSitio={terminoSitio}
      anio={anio}
      mes={mes}
      area="Comedor"
      items={items}
      resultados={resultados}
      diasData={diasData}
      conConcentraciones={true}
      observaciones={observaciones}
      firmaRealizo={firmaRealizo}
      firmaVerifico={firmaVerifico}
    />
  )
}

export function LimpiezaComedorPDF(props: LimpiezaComedorPaginaProps) {
  return (
    <Document title={`Limpieza Comedor ${mesNombre(props.anio, props.mes)}`} author="M.A.D.Y." creator="M.A.D.Y. Inocuidad Inteligente" producer="M.A.D.Y. Inocuidad Inteligente" subject={`Bitácora de Limpieza del Comedor — ${props.instalacion}`} keywords="MADY, inocuidad, limpieza, comedor">
      <LimpiezaComedorPagina {...props} />
    </Document>
  )
}

export function LimpiezaComedorConsolidadoPDF({ paginas }: LimpiezaComedorConsolidadoProps) {
  return (
    <Document title="Limpieza Comedor Consolidado" author="M.A.D.Y." creator="M.A.D.Y. Inocuidad Inteligente" producer="M.A.D.Y. Inocuidad Inteligente" subject="Bitácora de Limpieza del Comedor — Consolidado" keywords="MADY, inocuidad, limpieza, comedor, consolidado">
      {paginas.map((p, i) => <LimpiezaComedorPagina key={i} {...p} />)}
    </Document>
  )
}
