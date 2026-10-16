import { Document, View, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface SanitizacionCosechaRow {
  fecha: string
  rancho: string
  sector: string
  empaque_o_granel: string
  cantidad_ton: number
  canastos: number
  herramientas_sanitizadas: number
  producto_sanitizante: string
  ppm: number
  hora: string | null
  realizo: string | null
  observaciones: string | null
}

interface Props {
  rows: SanitizacionCosechaRow[]
  orgNombre?: string | null
  desde: string
  hasta: string
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const COLS = (terminoSitio: string): ColumnaDato[] => [
  { texto: 'Fecha', ancho: 50 },
  { texto: terminoSitio, ancho: 65 },
  { texto: 'Sector', ancho: 65 },
  { texto: 'Tipo', ancho: 45, align: 'center' },
  { texto: 'Ton.', ancho: 38, align: 'center' },
  { texto: 'Canastos', ancho: 38, align: 'center' },
  { texto: 'Herr. san.', ancho: 45, align: 'center' },
  { texto: 'Producto sanitizante', ancho: 90 },
  { texto: 'PPM', ancho: 38, align: 'center' },
  { texto: 'Hora', ancho: 38, align: 'center' },
  { texto: 'Realizo', ancho: 75 },
]

export function SanitizacionCosechaPDF({ rows, orgNombre, desde, hasta, codigoClave, terminoSitio = 'Instalacion', firmaRealizo, firmaVerifico }: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`
  const codigoFmt = codigoFormato('M65-SAN-COS', codigoClave)

  return (
    <Document>
      <PaginaEstandar
        titulo="SANITIZACIÓN DE HERRAMIENTAS EN COSECHA"
        subtitulo={"Registro de sanitizacion de herramientas de cosecha"}
        codigoFmt={codigoFmt}
        folio={periodo}
        emision={periodo}
        etiquetaEmision="Periodo"
        tituloDatos="1. INFORMACION GENERAL"
        camposDatos={[
          { icono: 'usuario', etiqueta: 'Organizacion', valor: orgNombre ?? '—' },
          { icono: 'calendario', etiqueta: 'Periodo', valor: periodo },
        ]}
      >
        <Seccion titulo="2. REGISTROS">
          <TablaDatos
            columnas={COLS(terminoSitio)}
            fuente={6.5}
            filas={rows.map((r) => [
              fmtFecha(r.fecha), r.rancho, r.sector, r.empaque_o_granel, String(r.cantidad_ton), String(r.canastos), String(r.herramientas_sanitizadas), r.producto_sanitizante, String(r.ppm), r.hora ?? '—', r.realizo ?? '—',
            ])}
          />
        </Seccion>

        {rows.some((r) => r.observaciones) && (
          <Seccion titulo="3. OBSERVACIONES">
            <View style={{ backgroundColor: PC.m13Fondo, borderRadius: 6, padding: 8, marginBottom: 8 }}>
              {rows.filter((r) => r.observaciones).map((r, i) => (
                <View key={i} wrap={false} style={{ marginBottom: 4 }}>
                  {rows.length > 1 && (
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.textSub }}>
                      {fmtFecha(r.fecha)} - {r.rancho} - {r.sector}
                    </Text>
                  )}
                  <Text style={{ fontSize: 7, color: PC.fieldValue }} hyphenationCallback={partirPalabraLarga}>
                    {r.observaciones}
                  </Text>
                </View>
              ))}
            </View>
          </Seccion>
        )}

        <PdfFirmas
          signatures={[
            { label: '', nombre: '', caption: 'Realizo', firma: firmaRealizo ?? null },
            { label: '', nombre: '', caption: 'Verifico: Responsable de Inocuidad', firma: firmaVerifico ?? null },
          ]}
        />
      </PaginaEstandar>
    </Document>
  )
}
