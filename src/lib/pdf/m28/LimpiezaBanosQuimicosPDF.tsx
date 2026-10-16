// PATRÓN INOCUIDAD — PDF M28 (plantilla homogénea M.A.D.Y)
// Bitácora de limpieza de baños y almacén de químicos — A4 landscape, matriz mensual (diseño nuevo: PaginaBitacoraMensual).

import { Document } from '@react-pdf/renderer'
import { PaginaBitacoraMensual, mesNombre } from '@/lib/pdf/disenoNuevo/PaginaBitacoraMensual'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ValorM28PDF = 'hecho' | 'no_hecho' | 'na'

export interface M28ItemPDF { id: string; nombre: string; frecuencia: string }

export interface M28DiaDataPDF {
  concentracion_cloro: number | null
  ajuste_cloro: string | null
  concentracion_acido: number | null
  ajuste_acido: string | null
  realizo: string | null
  aprobo: string | null
}

export interface LimpiezaBanosQuimicosPaginaProps {
  instalacion: string
  instalacionCodigo: string
  anio: number
  mes: number
  items: M28ItemPDF[]
  resultados: Record<number, Record<string, ValorM28PDF>>
  diasData: Record<number, M28DiaDataPDF>
  observaciones: string | null
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface LimpiezaBanosQuimicosConsolidadoProps {
  paginas: LimpiezaBanosQuimicosPaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── LimpiezaBanosQuimicosPagina ───────────────────────────────────────────

export function LimpiezaBanosQuimicosPagina({
  instalacion, instalacionCodigo, anio, mes, items, resultados, diasData,
  observaciones, codigoClave, terminoSitio = 'Instalación', firmaRealizo, firmaVerifico,
}: LimpiezaBanosQuimicosPaginaProps) {
  return (
    <PaginaBitacoraMensual
      titulo="BITÁCORA DE LIMPIEZA DE BAÑOS Y ALMACÉN DE QUÍMICOS"
      codigoFmt={codigoFormato('F-FRUS-SAN-06', codigoClave)}
      instalacion={instalacion}
      instalacionCodigo={instalacionCodigo}
      terminoSitio={terminoSitio}
      anio={anio}
      mes={mes}
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

export function LimpiezaBanosQuimicosPDF(props: LimpiezaBanosQuimicosPaginaProps) {
  return (
    <Document
      title={`Limpieza Banos Quimicos ${mesNombre(props.anio, props.mes)}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Bitácora de Limpieza de Baños y Almacén de Químicos — ${props.instalacion}`}
      keywords="MADY, inocuidad, limpieza, banos, quimicos"
    >
      <LimpiezaBanosQuimicosPagina {...props} />
    </Document>
  )
}

export function LimpiezaBanosQuimicosConsolidadoPDF({ paginas }: LimpiezaBanosQuimicosConsolidadoProps) {
  return (
    <Document
      title="Limpieza Banos Quimicos Consolidado"
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Bitácora de Limpieza de Baños y Almacén de Químicos — Consolidado"
      keywords="MADY, inocuidad, limpieza, banos, quimicos, consolidado"
    >
      {paginas.map((p, i) => <LimpiezaBanosQuimicosPagina key={i} {...p} />)}
    </Document>
  )
}
