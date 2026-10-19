// PATRÓN INOCUIDAD — PDF M34 (plantilla homogénea M.A.D.Y)
// Bitácora de limpieza de los cuartos de pre-enfrío y conservador — A4 landscape, matriz mensual (diseño nuevo: PaginaBitacoraMensual).

import { Document } from '@react-pdf/renderer'
import { PaginaBitacoraMensual, mesNombre } from '@/lib/pdf/disenoNuevo/PaginaBitacoraMensual'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ValorM34PDF = 'hecho' | 'no_hecho' | 'na'

export interface M34ItemPDF { id: string; nombre: string; frecuencia: string; es_inspeccion_plaga: boolean }

export interface M34DiaDataPDF {
  concentracion_cloro: number | null
  ajuste_cloro: string | null
  concentracion_acido: number | null
  ajuste_acido: string | null
  realizo: string | null
  aprobo: string | null
}

export interface LimpiezaPreenfrioPaginaProps {
  instalacion: string
  instalacionCodigo: string
  anio: number
  mes: number
  items: M34ItemPDF[]
  resultados: Record<number, Record<string, ValorM34PDF>>
  diasData: Record<number, M34DiaDataPDF>
  observaciones: string | null
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface LimpiezaPreenfrioConsolidadoProps {
  paginas: LimpiezaPreenfrioPaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── LimpiezaPreenfrioPagina ───────────────────────────────────────────────

export function LimpiezaPreenfrioPagina({
  instalacion, instalacionCodigo, anio, mes, items, resultados, diasData,
  observaciones, codigoClave, terminoSitio = 'Instalación', firmaRealizo, firmaVerifico,
}: LimpiezaPreenfrioPaginaProps) {
  return (
    <PaginaBitacoraMensual
      titulo="BITÁCORA DE LIMPIEZA DE LOS CUARTOS DE PRE-ENFRÍO Y CONSERVADOR"
      codigoFmt={codigoFormato('F-FRUS-SAN-12', codigoClave)}
      instalacion={instalacion}
      instalacionCodigo={instalacionCodigo}
      terminoSitio={terminoSitio}
      anio={anio}
      mes={mes}
      area="Cuartos de pre-enfrío y conservador"
      items={items}
      resultados={resultados}
      diasData={diasData}
      conConcentraciones={true}
      observaciones={observaciones}
      formatoValor={(v, item) =>
        item.es_inspeccion_plaga
          ? v === 'na' ? { texto: 'Sin plaga', tono: 'ok' } : v === 'hecho' ? { texto: 'Con plaga', tono: 'mal' } : { texto: '', tono: 'neutro' }
          : null
      }
      nota={"Nota: Concentración cloro recomendada 100-200 ppm. Ajuste si la concentración está fuera del rango. En caso de hallazgo de plaga se registra incidencia en M13."}
      notaDespuesDeObs
      firmaRealizo={firmaRealizo}
      firmaVerifico={firmaVerifico}
    />
  )
}

export function LimpiezaPreenfrioPDF(props: LimpiezaPreenfrioPaginaProps) {
  return (
    <Document
      title={`Limpieza Pre-enfrio ${mesNombre(props.anio, props.mes)}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Bitácora de Limpieza de Cuartos de Pre-enfrío — ${props.instalacion}`}
      keywords="MADY, inocuidad, limpieza, preenfrio, conservador"
    >
      <LimpiezaPreenfrioPagina {...props} />
    </Document>
  )
}

export function LimpiezaPreenfrioConsolidadoPDF({ paginas }: LimpiezaPreenfrioConsolidadoProps) {
  return (
    <Document
      title="Limpieza Pre-enfrio Consolidado"
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Bitácora de Limpieza de Cuartos de Pre-enfrío — Consolidado"
      keywords="MADY, inocuidad, limpieza, preenfrio, conservador, consolidado"
    >
      {paginas.map((p, i) => <LimpiezaPreenfrioPagina key={i} {...p} />)}
    </Document>
  )
}
