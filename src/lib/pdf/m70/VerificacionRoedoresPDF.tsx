import { Document, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface VerificacionRoedorFilaPDF {
  id: string
  fecha: string
  num_trampa: string
  roedor: boolean
  insectos: boolean
  otros: boolean
  cambio: boolean
  verifico: string | null
  observaciones: string | null
}

export interface VerificacionRoedoresPDFProps {
  rancho: string
  orgNombre?: string | null
  filas: VerificacionRoedorFilaPDF[]
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const COL = {
  fecha: 65,
  trampa: 75,
  boolW: 36,    // cada subcolumna Si / No
  verifico: 160,
  obs: 160,
}

function formatFecha(f: string) {
  try {
    return new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return f }
}

const BOOL_GROUPS: { key: keyof VerificacionRoedorFilaPDF; label: string }[] = [
  { key: 'roedor', label: 'Roedor' },
  { key: 'insectos', label: 'Insectos' },
  { key: 'otros', label: 'Otros' },
  { key: 'cambio', label: 'Cambio' },
]

// La "X" marca la respuesta elegida (Si o No); no es un valor negativo
const marca = (v: boolean) => (v ? { texto: 'X', color: PC.m13Navy, negrita: true } : '')

const COLUMNAS: ColumnaDato[] = [
  { texto: '', ancho: COL.fecha },
  { texto: '', ancho: COL.trampa },
  ...BOOL_GROUPS.flatMap(() => [
    { texto: 'Si', ancho: COL.boolW, align: 'center' as const },
    { texto: 'No', ancho: COL.boolW, align: 'center' as const },
  ]),
  { texto: '', ancho: COL.verifico },
  { texto: '', ancho: COL.obs },
]

const GRUPOS = [
  { texto: 'Fecha', ancho: COL.fecha },
  { texto: '# Trampa', ancho: COL.trampa },
  ...BOOL_GROUPS.map((g) => ({ texto: g.label, ancho: COL.boolW * 2 })),
  { texto: 'Verificó', ancho: COL.verifico },
  { texto: 'Observaciones', ancho: COL.obs },
]

export function VerificacionRoedoresPagina({ rancho, orgNombre, filas, firmaRealizo, firmaVerifico }: VerificacionRoedoresPDFProps) {
  const folio = filas[0]?.fecha ?? '—'
  return (
    <PaginaEstandar
      titulo="VERIFICACIÓN DE TRAMPAS PARA ROEDORES"
      subtitulo={`REG-24 · Global G.A.P. v6 | ${rancho}`}
      codigoFmt="REG-24"
      folio={folio}
      emision={folio}
      etiquetaEmision="Fecha"
      tituloDatos="DATOS GENERALES"
      camposDatos={[
        ...(orgNombre ? [{ icono: 'usuario' as const, etiqueta: 'Compañía', valor: orgNombre }] : []),
        { icono: 'ubicacion', etiqueta: 'Rancho', valor: rancho },
      ]}
    >
      <TablaDatos
        columnas={COLUMNAS}
        encabezadoSuperior={GRUPOS}
        sinNegativos
        fuente={7}
        fuenteEnc={6.5}
        filas={filas.map((f) => [
          formatFecha(f.fecha),
          f.num_trampa,
          ...BOOL_GROUPS.flatMap((g) => {
            const val = f[g.key] as boolean
            return [marca(val), marca(!val)]
          }),
          f.verifico ?? '',
          f.observaciones ?? '',
        ])}
      />

      <Text style={{ fontSize: 6, color: PC.textSub, fontFamily: 'Helvetica-Oblique', marginBottom: 6 }}>
        El formato debe llenarse en cada verificacion y este formato debe mantenerse en cada trampa muestreada.
      </Text>

      <PdfFirmas
        signatures={[
          { label: '', nombre: '', caption: 'Nombre y firma de quien realiza', firma: firmaRealizo ?? null },
          { label: '', nombre: '', caption: 'Nombre y firma de quien verifica', firma: firmaVerifico ?? null },
        ]}
      />
    </PaginaEstandar>
  )
}

export function VerificacionRoedoresPDF(props: VerificacionRoedoresPDFProps) {
  return (
    <Document>
      <VerificacionRoedoresPagina {...props} />
    </Document>
  )
}

export function VerificacionRoedoresConsolidadoPDF({ filas, orgNombre }: {
  filas: VerificacionRoedorFilaPDF[]
  rancho: string
  orgNombre?: string | null
}) {
  const ranchoMap = new Map<string, { nombre: string; filas: VerificacionRoedorFilaPDF[] }>()
  for (const f of filas) {
    const key = (f as any).rancho ?? '—'
    if (!ranchoMap.has(key)) ranchoMap.set(key, { nombre: key, filas: [] })
    ranchoMap.get(key)!.filas.push(f)
  }
  return (
    <Document>
      {[...ranchoMap.values()].map(({ nombre, filas: rf }) => (
        <VerificacionRoedoresPagina
          key={nombre}
          rancho={nombre}
          orgNombre={orgNombre}
          filas={rf}
        />
      ))}
    </Document>
  )
}
