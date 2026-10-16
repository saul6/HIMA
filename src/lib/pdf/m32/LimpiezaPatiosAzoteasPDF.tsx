// PATRÓN INOCUIDAD — PDF M32 (plantilla homogénea M.A.D.Y)
// Bitácora de limpieza de patios exteriores y azoteas — A4 landscape, matriz mensual (diseño nuevo: PaginaBitacoraMensual).

import { Document } from '@react-pdf/renderer'
import { PaginaBitacoraMensual, mesNombre } from '@/lib/pdf/disenoNuevo/PaginaBitacoraMensual'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ValorM32PDF = 'hecho' | 'no_hecho' | 'na'
export interface M32ItemPDF { id: string; nombre: string; frecuencia: string }
export interface M32DiaDataPDF { realizo: string | null; aprobo: string | null }
export interface LimpiezaPatiosAzoteasPaginaProps {
  instalacion: string
  instalacionCodigo: string
  anio: number
  mes: number
  items: M32ItemPDF[]
  resultados: Record<number, Record<string, ValorM32PDF>>
  diasData: Record<number, M32DiaDataPDF>
  observaciones: string | null
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}
export interface LimpiezaPatiosAzoteasConsolidadoProps {
  paginas: LimpiezaPatiosAzoteasPaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── LimpiezaPatiosAzoteasPagina ───────────────────────────────────────────

export function LimpiezaPatiosAzoteasPagina({
  instalacion, instalacionCodigo, anio, mes, items, resultados, diasData,
  observaciones, codigoClave, terminoSitio = 'Instalación', firmaRealizo, firmaVerifico,
}: LimpiezaPatiosAzoteasPaginaProps) {
  return (
    <PaginaBitacoraMensual
      titulo="BITÁCORA DE LIMPIEZA DE PATIOS EXTERIORES Y AZOTEAS"
      codigoFmt={codigoFormato('F-FRUS-SAN-10', codigoClave)}
      instalacion={instalacion}
      instalacionCodigo={instalacionCodigo}
      terminoSitio={terminoSitio}
      anio={anio}
      mes={mes}
      area="Patios exteriores y azoteas"
      items={items}
      resultados={resultados}
      diasData={diasData}
      conConcentraciones={false}
      observaciones={observaciones}
      firmaRealizo={firmaRealizo}
      firmaVerifico={firmaVerifico}
    />
  )
}

export function LimpiezaPatiosAzoteasPDF(props: LimpiezaPatiosAzoteasPaginaProps) {
  return (
    <Document title={`Limpieza Patios Azoteas ${mesNombre(props.anio, props.mes)}`} author="M.A.D.Y." creator="M.A.D.Y. Inocuidad Inteligente" producer="M.A.D.Y. Inocuidad Inteligente" subject={`Bitácora de Limpieza de Patios Exteriores y Azoteas — ${props.instalacion}`} keywords="MADY, inocuidad, limpieza, patios, azoteas">
      <LimpiezaPatiosAzoteasPagina {...props} />
    </Document>
  )
}

export function LimpiezaPatiosAzoteasConsolidadoPDF({ paginas }: LimpiezaPatiosAzoteasConsolidadoProps) {
  return (
    <Document title="Limpieza Patios Azoteas Consolidado" author="M.A.D.Y." creator="M.A.D.Y. Inocuidad Inteligente" producer="M.A.D.Y. Inocuidad Inteligente" subject="Bitácora de Limpieza de Patios y Azoteas — Consolidado" keywords="MADY, inocuidad, limpieza, patios, azoteas, consolidado">
      {paginas.map((p, i) => <LimpiezaPatiosAzoteasPagina key={i} {...p} />)}
    </Document>
  )
}
