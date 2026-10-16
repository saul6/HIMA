import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { Leyenda } from '@/lib/pdf/disenoNuevo/Leyenda'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface MicroorganismoPDF {
  codigo: string
  label: string
  tipo: 'indicador' | 'patogeno'
  orden: number
}

export interface MuestraPDF {
  id: string
  fecha_muestreo: string
  hora_muestreo: string | null
  descripcion_muestra: string
  microorganismos: string[]
  laboratorio: string
  solicitante_nombre: string
}

export interface MuestrasLaboratorioPaginaProps {
  instalacion: string
  instalacionCodigo: string
  fecha: string
  microorganismos: MicroorganismoPDF[]
  muestras: MuestraPDF[]
  consolidado?: boolean
  desde?: string
  hasta?: string
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

export interface MuestrasLaboratorioConsolidadoProps {
  instalacion: string
  instalacionCodigo: string
  desde: string
  hasta: string
  microorganismos: MicroorganismoPDF[]
  muestras: MuestraPDF[]
  codigoClave: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const NUM_W = 16
const FECHA_W = 46
const HORA_W = 28
const DESC_W = 100
const MICRO_W = 38
const LAB_W = 64
const SOL_W = 64

const LABEL_MAP: Record<string, string> = {
  m_aerobias: 'M. aerobias',
  levaduras: 'Levaduras',
  hongos: 'Hongos',
  ct: 'C.T.',
  cf: 'C.F.',
  e_coli: 'E. coli',
  s_aureus: 'S. aureus',
  salmonella: 'Salmonella',
  shigella: 'Shigella',
  l_mono: 'L. mono',
  v_cholerae: 'V. cholerae',
  ecoli_o157: 'Ec O157:H7',
  stec: 'STEC',
  listeria: 'Listeria',
}

function formatFecha(f: string) {
  if (!f) return '—'
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

export function MuestrasLaboratorioPagina({
  instalacion,
  instalacionCodigo,
  fecha,
  microorganismos,
  muestras,
  consolidado,
  desde,
  hasta,
  codigoClave,
  terminoSitio = 'Instalación',
  firmaRealizo,
  firmaVerifico,
}: MuestrasLaboratorioPaginaProps) {
  const indicadores = microorganismos.filter(m => m.tipo === 'indicador').sort((a, b) => a.orden - b.orden)
  const patogenos = microorganismos.filter(m => m.tipo === 'patogeno').sort((a, b) => a.orden - b.orden)
  const periodoLabel = consolidado && desde && hasta
    ? `${formatFecha(desde)} al ${formatFecha(hasta)}`
    : formatFecha(fecha)
  const codigoFmt = codigoFormato('F-FRUS-CAL-24', codigoClave)

  const todos = [...indicadores, ...patogenos]
  const columnas: ColumnaDato[] = [
    { texto: 'No.', ancho: NUM_W, align: 'center' },
    { texto: 'Fecha de muestreo', ancho: FECHA_W },
    { texto: 'Hora', ancho: HORA_W },
    { texto: 'Descripcion de la muestra', ancho: DESC_W },
    ...todos.map((m): ColumnaDato => ({ texto: LABEL_MAP[m.codigo] ?? m.label ?? m.codigo, ancho: MICRO_W, align: 'center' })),
    { texto: 'Laboratorio', ancho: LAB_W },
    { texto: 'Solicitante', ancho: SOL_W },
  ]

  return (
    <PaginaEstandar
      titulo="REGISTRO DE MUESTRAS ENVIADAS AL LABORATORIO"
      subtitulo={`Muestras al laboratorio | ${instalacion}`}
      codigoFmt={codigoFmt}
      folio={periodoLabel}
      emision={periodoLabel}
      tituloDatos="1. DATOS DEL SITIO"
      camposDatos={[
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: instalacion },
        { icono: 'codigo', etiqueta: 'Codigo', valor: instalacionCodigo || '—' },
        { icono: 'calendario', etiqueta: 'Periodo', valor: periodoLabel },
      ]}
    >
      <Seccion titulo="2. MUESTRAS ENVIADAS">
        <TablaDatos
          columnas={columnas}
          fuente={7}
          fuenteEnc={6.5}
          sinNegativos
          encabezadoSuperior={[
            { texto: '', ancho: NUM_W + FECHA_W + HORA_W + DESC_W },
            { texto: 'm.o. Indicadores', ancho: indicadores.length * MICRO_W },
            { texto: 'm.o. Patogenos', ancho: patogenos.length * MICRO_W },
            { texto: '', ancho: LAB_W + SOL_W },
          ]}
          filas={muestras.map((m, i) => [
            String(i + 1),
            formatFecha(m.fecha_muestreo),
            m.hora_muestreo ?? '',
            m.descripcion_muestra,
            ...todos.map((mo) => (m.microorganismos.includes(mo.codigo) ? 'X' : '')),
            m.laboratorio,
            m.solicitante_nombre,
          ])}
        />
      </Seccion>

      <Leyenda
        entradas={[
          {
            titulo: 'Microorganismos',
            items: microorganismos.map((m) => ({ codigo: m.codigo, label: m.label })),
          },
        ]}
      />

      <PdfFirmas
        signatures={[
          { label: '', nombre: '', caption: 'Firma del solicitante', firma: firmaRealizo ?? null },
          { label: '', nombre: '', caption: 'Verificó — Firma', firma: firmaVerifico ?? null },
        ]}
      />
    </PaginaEstandar>
  )
}

export function MuestrasLaboratorioPDF(props: MuestrasLaboratorioPaginaProps) {
  return (
    <Document>
      <MuestrasLaboratorioPagina {...props} />
    </Document>
  )
}

export function MuestrasLaboratorioConsolidadoPDF({ instalacion, instalacionCodigo, desde, hasta, microorganismos, muestras, codigoClave, firmaRealizo, firmaVerifico }: MuestrasLaboratorioConsolidadoProps) {
  return (
    <Document>
      <MuestrasLaboratorioPagina
        instalacion={instalacion}
        instalacionCodigo={instalacionCodigo}
        fecha={desde}
        microorganismos={microorganismos}
        muestras={muestras}
        consolidado={true}
        desde={desde}
        hasta={hasta}
        codigoClave={codigoClave}
        firmaRealizo={firmaRealizo}
        firmaVerifico={firmaVerifico}
      />
    </Document>
  )
}
