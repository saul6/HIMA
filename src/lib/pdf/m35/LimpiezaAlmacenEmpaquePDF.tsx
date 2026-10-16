// PATRÓN INOCUIDAD — PDF M35 (plantilla homogénea M.A.D.Y)
// Bitácora de limpieza del almacén de material de empaque — A4 landscape, matriz mensual (diseño nuevo: PaginaBitacoraMensual).

import { Document } from '@react-pdf/renderer'
import { PaginaBitacoraMensual, mesNombre } from '@/lib/pdf/disenoNuevo/PaginaBitacoraMensual'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ValorM35PDF = 'hecho' | 'no_hecho' | 'na'
export interface M35ItemPDF { id: string; nombre: string; frecuencia: string; genera_incidencia: boolean }
export interface M35DiaDataPDF { realizo: string | null; aprobo: string | null }
export interface LimpiezaAlmacenEmpaquePaginaProps {
  instalacion: string
  instalacionCodigo: string
  anio: number
  mes: number
  items: M35ItemPDF[]
  resultados: Record<number, Record<string, ValorM35PDF>>
  diasData: Record<number, M35DiaDataPDF>
  observaciones: string | null
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}
export interface LimpiezaAlmacenEmpaqueConsolidadoProps {
  paginas: LimpiezaAlmacenEmpaquePaginaProps[]
  instalacionNombre: string
  desde: string
  hasta: string
}

// ── LimpiezaAlmacenEmpaquePagina ──────────────────────────────────────────

export function LimpiezaAlmacenEmpaquePagina({
  instalacion, instalacionCodigo, anio, mes, items, resultados, diasData,
  observaciones, codigoClave, terminoSitio = 'Instalación', firmaRealizo, firmaVerifico,
}: LimpiezaAlmacenEmpaquePaginaProps) {
  return (
    <PaginaBitacoraMensual
      titulo="BITÁCORA DE LIMPIEZA DEL ALMACÉN DE MATERIAL DE EMPAQUE"
      codigoFmt={codigoFormato('F-FRUS-SAN-13', codigoClave)}
      instalacion={instalacion}
      instalacionCodigo={instalacionCodigo}
      terminoSitio={terminoSitio}
      anio={anio}
      mes={mes}
      area="Almacén de material de empaque"
      items={items}
      resultados={resultados}
      diasData={diasData}
      conConcentraciones={false}
      observaciones={observaciones}
      formatoValor={(v, item) =>
        item.genera_incidencia
          ? v === 'hecho' ? { texto: 'Dano', tono: 'mal' } : v === 'na' ? { texto: 'OK', tono: 'ok' } : { texto: '', tono: 'neutro' }
          : null
      }
      nota={"Nota: En caso de detectar dano en micas o faros del montacargas, registrar incidencia en M13 - Reporte de Incidencias."}
      firmaRealizo={firmaRealizo}
      firmaVerifico={firmaVerifico}
    />
  )
}

export function LimpiezaAlmacenEmpaquePDF(props: LimpiezaAlmacenEmpaquePaginaProps) {
  return (
    <Document title={`Limpieza Almacen Empaque ${mesNombre(props.anio, props.mes)}`} author="M.A.D.Y." creator="M.A.D.Y. Inocuidad Inteligente" producer="M.A.D.Y. Inocuidad Inteligente" subject={`Bitácora de Limpieza del Almacén de Material de Empaque — ${props.instalacion}`} keywords="MADY, inocuidad, limpieza, almacen, empaque">
      <LimpiezaAlmacenEmpaquePagina {...props} />
    </Document>
  )
}

export function LimpiezaAlmacenEmpaqueConsolidadoPDF({ paginas }: LimpiezaAlmacenEmpaqueConsolidadoProps) {
  return (
    <Document title="Limpieza Almacen Empaque Consolidado" author="M.A.D.Y." creator="M.A.D.Y. Inocuidad Inteligente" producer="M.A.D.Y. Inocuidad Inteligente" subject="Bitácora de Limpieza del Almacén de Material de Empaque — Consolidado" keywords="MADY, inocuidad, limpieza, almacen, empaque, consolidado">
      {paginas.map((p, i) => <LimpiezaAlmacenEmpaquePagina key={i} {...p} />)}
    </Document>
  )
}
