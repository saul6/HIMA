import { Document, View } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { TablaDatos, ANCHO_UTIL, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'

export interface M68MatrizRow {
  criterio_numero: number
  criterio_descripcion: string
  trampas: boolean[]
}

export interface MonitoreoRoedoresPDFProps {
  rancho: string
  orgNombre?: string | null
  fecha: string
  ubicacion: string
  responsable: string | null
  observaciones: string | null
  matriz: M68MatrizRow[]
  num_trampas: number
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

const CRITERIO_COL_W = 200

function fmtFecha(iso: string): string {
  return fechaPdf(iso)
}

export function MonitoreoRoedoresPage({
  rancho,
  orgNombre,
  fecha,
  ubicacion,
  responsable,
  observaciones,
  matriz,
  num_trampas,
  firmaRealizo,
  firmaVerifico,
}: MonitoreoRoedoresPDFProps) {
  const trampaColW = Math.floor((ANCHO_UTIL.landscape - CRITERIO_COL_W) / num_trampas)
  const columnas: ColumnaDato[] = [
    { texto: 'Criterio de evaluación', ancho: CRITERIO_COL_W },
    ...Array.from({ length: num_trampas }, (_, i): ColumnaDato => ({ texto: `T${i + 1}`, ancho: trampaColW, align: 'center' })),
  ]

  return (
    <PaginaEstandar
      titulo="MONITOREO DE TRAMPAS PARA ROEDORES"
      subtitulo={`REG-23 · GlobalG.A.P. v6 | ${rancho}`}
      codigoFmt="REG-23"
      folio={fmtFecha(fecha)}
      emision={fmtFecha(fecha)}
      etiquetaEmision="Fecha"
      tituloDatos="1. DATOS GENERALES"
      camposDatos={[
        { icono: 'ubicacion', etiqueta: 'Rancho/Instalación', valor: rancho },
        { icono: 'ubicacion', etiqueta: 'Ubicación', valor: ubicacion },
        ...(orgNombre ? [{ icono: 'usuario' as const, etiqueta: 'Organización', valor: orgNombre }] : []),
        { icono: 'calendario', etiqueta: 'Fecha', valor: fmtFecha(fecha) },
        { etiqueta: 'No. de trampas', valor: String(num_trampas) },
        { icono: 'usuario', etiqueta: 'Responsable', valor: responsable ?? '—' },
      ]}
    >
      <Seccion titulo="2. MONITOREO DE TRAMPAS">
        {/* La "X" marca que la trampa cumple el criterio; no es un valor negativo */}
        <TablaDatos
          columnas={columnas}
          filas={matriz.map((row) => [
            `${row.criterio_numero}. ${row.criterio_descripcion}`,
            ...Array.from({ length: num_trampas }, (_, ti) => (row.trampas[ti] ? { texto: 'X', color: PC.m13Navy, negrita: true } : '')),
          ])}
        />
      </Seccion>

      {/* Observaciones y firmas juntas: las firmas nunca quedan solas en una hoja */}
      <View wrap={false}>
        {observaciones && (
          <Seccion titulo="3. OBSERVACIONES Y/O ACCIÓN CORRECTIVA">
            <FranjaDatos campos={[{ etiqueta: '', valor: observaciones }]} />
          </Seccion>
        )}

        <PdfFirmas
          signatures={[
            { label: '', nombre: '', caption: 'Realizó', firma: firmaRealizo ?? null },
            { label: '', nombre: '', caption: 'Responsable de Inocuidad', firma: firmaVerifico ?? null },
          ]}
        />
      </View>
    </PaginaEstandar>
  )
}

export function MonitoreoRoedoresPDF(props: MonitoreoRoedoresPDFProps) {
  return (
    <Document>
      <MonitoreoRoedoresPage {...props} />
    </Document>
  )
}
