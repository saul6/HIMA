// PATRÓN INOCUIDAD — PDF M29 (plantilla homogénea M.A.D.Y)
// Bitácora de limpieza de la aduana — A4 landscape, matriz mensual (diseño nuevo: PaginaBitacoraMensual).

import { Document } from '@react-pdf/renderer'
import { PaginaBitacoraMensual, mesNombre } from '@/lib/pdf/disenoNuevo/PaginaBitacoraMensual'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ValorM29PDF = 'hecho' | 'no_hecho' | 'na'

export interface M29ItemPDF { id: string; nombre: string; frecuencia: string }

export interface M29DiaDataPDF {
  concentracion_cloro: number | null
  ajuste_cloro: string | null
  concentracion_acido: number | null
  ajuste_acido: string | null
  realizo: string | null
  aprobo: string | null
}

export interface LimpiezaAduanaPaginaProps {
  instalacion: string
  instalacionCodigo: string
  anio: number
  mes: number
  items: M29ItemPDF[]
  resultados: Record<number, Record<string, ValorM29PDF>>
  diasData: Record<number, M29DiaDataPDF>
  observaciones: string | null
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface LimpiezaAduanaConsolidadoProps {
  paginas: LimpiezaAduanaPaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── LimpiezaAduanaPagina ──────────────────────────────────────────────────

export function LimpiezaAduanaPagina({
  instalacion, instalacionCodigo, anio, mes, items, resultados, diasData,
  observaciones, codigoClave, terminoSitio = 'Instalación', firmaRealizo, firmaVerifico,
}: LimpiezaAduanaPaginaProps) {
  return (
    <PaginaBitacoraMensual
      titulo="BITÁCORA DE LIMPIEZA DE LA ADUANA"
      codigoFmt={codigoFormato('F-FRUS-SAN-07', codigoClave)}
      instalacion={instalacion}
      instalacionCodigo={instalacionCodigo}
      terminoSitio={terminoSitio}
      anio={anio}
      mes={mes}
      area="Aduana"
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

export function LimpiezaAduanaPDF(props: LimpiezaAduanaPaginaProps) {
  return (
    <Document
      title={`Limpieza Aduana ${mesNombre(props.anio, props.mes)}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Bitácora de Limpieza de la Aduana — ${props.instalacion}`}
      keywords="MADY, inocuidad, limpieza, aduana"
    >
      <LimpiezaAduanaPagina {...props} />
    </Document>
  )
}

export function LimpiezaAduanaConsolidadoPDF({ paginas }: LimpiezaAduanaConsolidadoProps) {
  return (
    <Document
      title="Limpieza Aduana Consolidado"
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Bitácora de Limpieza de la Aduana — Consolidado"
      keywords="MADY, inocuidad, limpieza, aduana, consolidado"
    >
      {paginas.map((p, i) => <LimpiezaAduanaPagina key={i} {...p} />)}
    </Document>
  )
}
