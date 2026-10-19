import { Document } from '@react-pdf/renderer'
import { PaginaEstandar } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { TablaDatos, ANCHO_UTIL, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface M72OrganismoPDF {
  id: string
  tipo: 'plaga' | 'enfermedad'
  nombre: string
}

export interface M72FilaPDF {
  sector: string
  num_planta: number
  conteos: Record<string, number>  // organismo_id → conteo
  comentario?: string | null
}

export interface MonitoreoPlaguasPDFProps {
  rancho: string
  orgNombre?: string | null
  fecha: string
  etapa_fenologica: string | null
  realizo: string | null
  beneficos: string | null
  observaciones: string | null
  organismos: M72OrganismoPDF[]
  filas: M72FilaPDF[]
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

const COL_SECTOR = 65
const COL_PLANTA = 40
const COL_OBS = 70
const COL_ORG_MIN = 38

function formatFecha(f: string) {
  try {
    return new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return f }
}

export function MonitoreoPlaguasPagina({
  rancho, orgNombre, fecha, etapa_fenologica, realizo, beneficos, observaciones,
  organismos, filas, firmaRealizo, firmaVerifico,
}: MonitoreoPlaguasPDFProps) {
  const plagas = organismos.filter(o => o.tipo === 'plaga')
  const enfermedades = organismos.filter(o => o.tipo === 'enfermedad')
  const todosOrg = [...plagas, ...enfermedades]

  // Reparte el ancho entre las columnas de organismos
  const fixedW = COL_SECTOR + COL_PLANTA + COL_OBS
  const availableForOrg = 555 - fixedW
  const orgColW = todosOrg.length > 0
    ? Math.max(COL_ORG_MIN, Math.floor(availableForOrg / todosOrg.length))
    : COL_ORG_MIN

  // Totales por organismo
  const totales: Record<string, number> = {}
  for (const org of todosOrg) {
    totales[org.id] = filas.reduce((sum, f) => sum + (f.conteos[org.id] ?? 0), 0)
  }
  const totalPlantas = filas.length

  const columnas: ColumnaDato[] = [
    { texto: 'Sector', ancho: COL_SECTOR },
    { texto: '# Planta', ancho: COL_PLANTA, align: 'center' },
    ...todosOrg.map((o): ColumnaDato => ({ texto: o.nombre, ancho: orgColW, align: 'center' })),
    { texto: 'Observaciones', ancho: COL_OBS },
  ]
  const grupos = [
    { texto: '', ancho: COL_SECTOR + COL_PLANTA },
    ...(plagas.length > 0 ? [{ texto: 'Plagas', ancho: orgColW * plagas.length }] : []),
    ...(enfermedades.length > 0 ? [{ texto: 'Enfermedades', ancho: orgColW * enfermedades.length }] : []),
    { texto: '', ancho: COL_OBS },
  ]

  const datos = filas.map((f) => [
    f.sector,
    String(f.num_planta),
    ...todosOrg.map((o) => (f.conteos[o.id] ? String(f.conteos[o.id]) : '')),
    f.comentario ?? '',
  ])
  const pie = filas.length > 0
    ? [
        [{ texto: 'Total', negrita: true }, { texto: String(totalPlantas), negrita: true }, ...todosOrg.map((o) => ({ texto: totales[o.id] ? String(totales[o.id]) : '', negrita: true })), ''],
        [{ texto: '% Incidencia', negrita: true }, '', ...todosOrg.map((o) => {
          const pct = totalPlantas > 0
            ? ((filas.filter(f => (f.conteos[o.id] ?? 0) > 0).length / totalPlantas) * 100).toFixed(1)
            : '0.0'
          return `${pct}%`
        }), ''],
      ]
    : []

  return (
    <PaginaEstandar
      orientacion="portrait"
      titulo="MONITOREO DE PLAGAS Y ENFERMEDADES"
      subtitulo={`REG-21 · Global G.A.P. v6 | ${rancho}`}
      codigoFmt="REG-21"
      folio={fecha}
      emision={fecha}
      etiquetaEmision="Fecha"
      tituloDatos="DATOS GENERALES"
      porRenglon={3}
      camposDatos={[
        ...(orgNombre ? [{ icono: 'usuario' as const, etiqueta: 'Compañía', valor: orgNombre }] : []),
        { icono: 'ubicacion', etiqueta: 'Rancho', valor: rancho },
        { icono: 'calendario', etiqueta: 'Fecha', valor: formatFecha(fecha) },
        ...(etapa_fenologica ? [{ etiqueta: 'Etapa fenológica', valor: etapa_fenologica }] : []),
        ...(beneficos ? [{ etiqueta: 'Benéficos', valor: beneficos }] : []),
      ]}
    >
      <TablaDatos
        columnas={columnas}
        encabezadoSuperior={plagas.length > 0 || enfermedades.length > 0 ? grupos : undefined}
        anchoTotal={ANCHO_UTIL.portrait}
        fuente={6.5}
        fuenteEnc={6}
        sinNegativos
        filas={[...datos, ...pie]}
      />

      {observaciones && <FranjaDatos campos={[{ etiqueta: 'Observaciones', valor: observaciones }]} />}

      <PdfFirmas
        signatures={[
          { label: '', nombre: realizo ?? '', caption: 'Realizó', firma: firmaRealizo ?? null },
          { label: '', nombre: '', caption: 'Verificó', firma: firmaVerifico ?? null },
        ]}
      />
    </PaginaEstandar>
  )
}

export function MonitoreoPlaguasPDF(props: MonitoreoPlaguasPDFProps) {
  return (
    <Document>
      <MonitoreoPlaguasPagina {...props} />
    </Document>
  )
}

export function MonitoreoPlaguasConsolidadoPDF({ paginas }: { paginas: MonitoreoPlaguasPDFProps[] }) {
  return (
    <Document>
      {paginas.map((p, i) => <MonitoreoPlaguasPagina key={i} {...p} />)}
    </Document>
  )
}
