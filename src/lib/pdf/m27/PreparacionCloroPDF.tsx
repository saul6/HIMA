// PATRÓN INOCUIDAD — PDF M27 (plantilla homogénea M.A.D.Y)
// Preparación de Cloro a 200 ppm — A4 portrait.
// PdfPageFrame + PdfHeader + tabla de preparaciones + PdfSignatures.

import { Document, View, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, ANCHO_UTIL, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface PreparacionPDFRow {
  fecha: string
  area: string
  litros_agua: number
  ml_cloro: number
  responsable: string | null
  observaciones: string | null
}

export interface PreparacionCloroPaginaProps {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  preparaciones: PreparacionPDFRow[]
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

// Columnas (anchos relativos; la tabla se escala al ancho útil de la hoja)
const COLS: ColumnaDato[] = [
  { texto: 'N.', ancho: 20, align: 'center' },
  { texto: 'Fecha', ancho: 60 },
  { texto: 'Area / Punto de aplicacion', ancho: 160 },
  { texto: 'Litros agua', ancho: 44, align: 'center' },
  { texto: 'mL cloro', ancho: 44, align: 'center' },
  { texto: 'Responsable', ancho: 100 },
  { texto: 'Observaciones', ancho: 89 },
]

// ── PreparacionCloroPagina ────────────────────────────────────────────────────

export function PreparacionCloroPagina({
  rancho, orgNombre, desde, hasta, preparaciones, codigoClave, terminoSitio = 'Instalación',
  firmaRealizo, firmaVerifico,
}: PreparacionCloroPaginaProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const codigoFmt = codigoFormato('F-FRUS-SAN-03', codigoClave)
  const periodoLabel = desde === hasta ? fmt(desde) : `${fmt(desde)} — ${fmt(hasta)}`
  const totalLabel = String(preparaciones.length)

  return (
    <PaginaEstandar
      orientacion="portrait"
      titulo="PREPARACIÓN DE CLORO A 200 ppm"
      subtitulo={`Formato operativo | ${rancho}`}
      codigoFmt={codigoFmt}
      folio={desde}
      emision={emision}
      tituloDatos="1. DATOS GENERALES"
      camposDatos={[
        ...(orgNombre ? [{ icono: 'usuario' as const, etiqueta: 'Organización', valor: orgNombre }] : []),
        { icono: 'ubicacion', etiqueta: terminoSitio, valor: rancho },
        { icono: 'calendario', etiqueta: 'Periodo', valor: periodoLabel },
        { etiqueta: 'Total de preparaciones', valor: totalLabel },
      ]}
    >
      <Seccion titulo="2. REGISTRO DE PREPARACIONES">
        <TablaDatos
          columnas={COLS}
          anchoTotal={ANCHO_UTIL.portrait}
          vacio="Sin registros"
          filas={preparaciones.map((p, i) => [
            String(i + 1),
            fmt(p.fecha),
            p.area,
            `${p.litros_agua} L`,
            `${p.ml_cloro} mL`,
            p.responsable ?? '',
            p.observaciones ?? '',
          ])}
        />
      </Seccion>

      {/* Nota de fórmula */}
      <View wrap={false} style={{ marginBottom: 10, padding: 8, borderRadius: 6, backgroundColor: PC.m13Fondo }}>
        <Text style={{ fontSize: 7, color: PC.textSub, lineHeight: 1.4 }}>
          Nota: Para obtener 200 ppm con cloro comercial (~6%): 3.33 mL de cloro por litro de agua.{'\n'}
          Formula: mL de cloro = Litros de agua x 10/3
        </Text>
      </View>

      <View wrap={false}>
        <Seccion titulo="3. FIRMAS Y RESPONSABLES">
          <PdfFirmas
            signatures={[
              { label: 'Elaboro', nombre: '', caption: 'Firma', firma: firmaRealizo ?? null },
              { label: '', nombre: '', caption: 'Verifico — Responsable de Inocuidad — Firma', firma: firmaVerifico ?? null },
            ]}
          />
        </Seccion>
      </View>
    </PaginaEstandar>
  )
}

// ── PreparacionCloroPDF ───────────────────────────────────────────────────────

export function PreparacionCloroPDF(props: PreparacionCloroPaginaProps) {
  return (
    <Document
      title={`Preparacion de Cloro ${props.rancho} ${props.desde}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject={`Preparacion de Cloro a 200 ppm — ${codigoFormato('F-FRUS-SAN-03', props.codigoClave)}`}
      keywords="MADY, inocuidad, cloro, preparacion, desinfeccion"
    >
      <PreparacionCloroPagina {...props} />
    </Document>
  )
}
