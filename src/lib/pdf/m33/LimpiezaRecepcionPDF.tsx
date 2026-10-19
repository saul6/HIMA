// PATRÓN INOCUIDAD — PDF M33 (plantilla homogénea M.A.D.Y)
// Bitácora de limpieza del área de recepción — A4 landscape, matriz mensual (diseño nuevo: PaginaBitacoraMensual).

import { Document } from '@react-pdf/renderer'
import { PaginaBitacoraMensual, mesNombre } from '@/lib/pdf/disenoNuevo/PaginaBitacoraMensual'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ValorM33PDF = 'hecho' | 'no_hecho' | 'na'
export interface M33ItemPDF { id: string; nombre: string; frecuencia: string }
export interface M33DiaDataPDF {
  concentracion_cloro: number | null
  ajuste_cloro: string | null
  concentracion_acido: number | null
  ajuste_acido: string | null
  realizo: string | null
  aprobo: string | null
}
export interface LimpiezaRecepcionPaginaProps {
  instalacion: string
  instalacionCodigo: string
  anio: number
  mes: number
  items: M33ItemPDF[]
  resultados: Record<number, Record<string, ValorM33PDF>>
  diasData: Record<number, M33DiaDataPDF>
  observaciones: string | null
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}
export interface LimpiezaRecepcionConsolidadoProps {
  paginas: LimpiezaRecepcionPaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── LimpiezaRecepcionPagina ───────────────────────────────────────────────

export function LimpiezaRecepcionPagina({
  instalacion, instalacionCodigo, anio, mes, items, resultados, diasData,
  observaciones, codigoClave, terminoSitio = 'Instalación', firmaRealizo, firmaVerifico,
}: LimpiezaRecepcionPaginaProps) {
  return (
    <PaginaBitacoraMensual
      titulo="BITÁCORA DE LIMPIEZA DEL ÁREA DE RECEPCIÓN"
      codigoFmt={codigoFormato('F-FRUS-SAN-11', codigoClave)}
      instalacion={instalacion}
      instalacionCodigo={instalacionCodigo}
      terminoSitio={terminoSitio}
      anio={anio}
      mes={mes}
      area="Área de recepción"
      items={items}
      resultados={resultados}
      diasData={diasData}
      conConcentraciones={true}
      observaciones={observaciones}
      nota={"Nota: Concentración cloro recomendada 100-200 ppm. Ajuste si la concentración está fuera del rango."}
      firmaRealizo={firmaRealizo}
      firmaVerifico={firmaVerifico}
    />
  )
}

export function LimpiezaRecepcionPDF(props: LimpiezaRecepcionPaginaProps) {
  return (
    <Document title={`Limpieza Recepcion ${mesNombre(props.anio, props.mes)}`} author="M.A.D.Y." creator="M.A.D.Y. Inocuidad Inteligente" producer="M.A.D.Y. Inocuidad Inteligente" subject={`Bitácora de Limpieza del Área de Recepción — ${props.instalacion}`} keywords="MADY, inocuidad, limpieza, recepcion">
      <LimpiezaRecepcionPagina {...props} />
    </Document>
  )
}

export function LimpiezaRecepcionConsolidadoPDF({ paginas }: LimpiezaRecepcionConsolidadoProps) {
  return (
    <Document title="Limpieza Recepcion Consolidado" author="M.A.D.Y." creator="M.A.D.Y. Inocuidad Inteligente" producer="M.A.D.Y. Inocuidad Inteligente" subject="Bitácora de Limpieza del Área de Recepción — Consolidado" keywords="MADY, inocuidad, limpieza, recepcion, consolidado">
      {paginas.map((p, i) => <LimpiezaRecepcionPagina key={i} {...p} />)}
    </Document>
  )
}
