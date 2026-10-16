import { Document, View, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { PC } from '@/lib/pdf/components/tokens'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface GestionResiduosRow {
  fecha: string
  fuente_residuo: string
  descripcion: string | null
  clasificacion: string | null
  destino_final: string | null
  cantidad: string | null
  realizo: string | null
  observaciones: string | null
}

interface Props {
  rancho: string
  orgNombre?: string | null
  desde: string
  hasta: string
  registros: GestionResiduosRow[]
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
const COLS: ColumnaDato[] = [
  { texto: 'Fecha', ancho: 70 },
  { texto: 'Fuente de residuo', ancho: 140 },
  { texto: 'Descripcion', ancho: 190 },
  { texto: 'Clasificacion', ancho: 110 },
  { texto: 'Destino final', ancho: 140 },
  { texto: 'Cantidad', ancho: 70, align: 'center' },
  { texto: 'Realizo', ancho: 82 },
]

export function GestionResiduosPDF({ rancho, orgNombre, desde, hasta, registros, terminoSitio = 'Instalacion', firmaRealizo, firmaVerifico }: Props) {
  const periodo = desde === hasta ? fmtFecha(desde) : `${fmtFecha(desde)} - ${fmtFecha(hasta)}`

  return (
    <Document>
      <PaginaEstandar
        titulo="SISTEMA DE GESTIÓN DE RESIDUOS"
        subtitulo={`Registro de residuos | ${rancho}`}
        codigoFmt="M61"
        folio={periodo}
        emision={periodo}
        etiquetaEmision="Periodo"
        tituloDatos="1. DATOS DEL SITIO"
        camposDatos={[
          { icono: 'ubicacion', etiqueta: terminoSitio, valor: rancho },
          ...(orgNombre ? [{ icono: 'usuario' as const, etiqueta: 'Organizacion', valor: orgNombre }] : []),
          { icono: 'calendario', etiqueta: 'Periodo', valor: periodo },
        ]}
      >
        <Seccion titulo="2. REGISTROS DE RESIDUOS">
          <TablaDatos
            columnas={COLS}
            fuente={7}
            filas={registros.map((r) => [
              fmtFecha(r.fecha), r.fuente_residuo, r.descripcion ?? '—', r.clasificacion ?? '—', r.destino_final ?? '—', r.cantidad ?? '—', r.realizo ?? '—',
            ])}
          />
        </Seccion>

        {registros.some((r) => r.observaciones) && (
          <Seccion titulo="3. OBSERVACIONES">
            <View style={{ backgroundColor: PC.m13Fondo, borderRadius: 6, padding: 8, marginBottom: 8 }}>
              {registros.filter((r) => r.observaciones).map((r, i) => (
                <View key={i} wrap={false} style={{ marginBottom: 4 }}>
                  {registros.length > 1 && (
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: PC.textSub }}>
                      {fmtFecha(r.fecha)} - {r.fuente_residuo}
                    </Text>
                  )}
                  <Text style={{ fontSize: 7.5, color: PC.fieldValue }} hyphenationCallback={partirPalabraLarga}>
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
            { label: '', nombre: '', caption: 'Responsable de Inocuidad', firma: firmaVerifico ?? null },
          ]}
        />
      </PaginaEstandar>
    </Document>
  )
}
