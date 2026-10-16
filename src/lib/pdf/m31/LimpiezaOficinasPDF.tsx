// PATRÓN INOCUIDAD — PDF M31 (plantilla homogénea M.A.D.Y)
// Bitácora de limpieza de las oficinas — A4 landscape, matriz mensual (diseño nuevo: PaginaBitacoraMensual).

import { Document } from '@react-pdf/renderer'
import { PaginaBitacoraMensual, mesNombre } from '@/lib/pdf/disenoNuevo/PaginaBitacoraMensual'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ValorM31PDF = 'hecho' | 'no_hecho' | 'na'

export interface M31ItemPDF { id: string; nombre: string; frecuencia: string }

export interface M31DiaDataPDF {
  realizo: string | null
  aprobo: string | null
}

export interface LimpiezaOficinasPaginaProps {
  instalacion: string
  instalacionCodigo: string
  anio: number
  mes: number
  items: M31ItemPDF[]
  resultados: Record<number, Record<string, ValorM31PDF>>
  diasData: Record<number, M31DiaDataPDF>
  observaciones: string | null
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface LimpiezaOficinasConsolidadoProps {
  paginas: LimpiezaOficinasPaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── LimpiezaOficinasPagina ────────────────────────────────────────────────

export function LimpiezaOficinasPagina({
  instalacion, instalacionCodigo, anio, mes, items, resultados, diasData,
  observaciones, codigoClave, terminoSitio = 'Instalación', firmaRealizo, firmaVerifico,
}: LimpiezaOficinasPaginaProps) {
  return (
    <PaginaBitacoraMensual
      titulo="BITÁCORA DE LIMPIEZA DE LAS OFICINAS"
      codigoFmt={codigoFormato('F-FRUS-SAN-09', codigoClave)}
      instalacion={instalacion}
      instalacionCodigo={instalacionCodigo}
      terminoSitio={terminoSitio}
      anio={anio}
      mes={mes}
      area="Oficinas"
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

export function LimpiezaOficinasPDF(props: LimpiezaOficinasPaginaProps) {
  return (
    <Document
      title={`Limpieza Oficinas ${mesNombre(props.anio, props.mes)}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Bitácora de Limpieza de las Oficinas — ${props.instalacion}`}
      keywords="MADY, inocuidad, limpieza, oficinas"
    >
      <LimpiezaOficinasPagina {...props} />
    </Document>
  )
}

export function LimpiezaOficinasConsolidadoPDF({ paginas }: LimpiezaOficinasConsolidadoProps) {
  return (
    <Document
      title="Limpieza Oficinas Consolidado"
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Bitácora de Limpieza de las Oficinas — Consolidado"
      keywords="MADY, inocuidad, limpieza, oficinas, consolidado"
    >
      {paginas.map((p, i) => <LimpiezaOficinasPagina key={i} {...p} />)}
    </Document>
  )
}
