import { Document, View, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, ANCHO_UTIL, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PC } from '@/lib/pdf/components/tokens'
import type { InventarioMovimiento } from '@/types/database.types'

const v = (s: string | number | null | undefined, fallback = '—') =>
  s != null && s !== '' ? String(s) : fallback

const fmtN = (n: number | null | undefined) =>
  n == null ? '' : Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(2)

const INV_COLS: ColumnaDato[] = [
  { texto: 'Fecha', ancho: 100, align: 'center' },
  { texto: 'Entrada', ancho: 120, align: 'center' },
  { texto: 'Salida', ancho: 120, align: 'center' },
  { texto: 'Existencia', ancho: 120, align: 'center' },
]

export interface GrupoProductoReg01 {
  productoId: string
  nombreComercial: string
  unidad: string | null
  movimientos: InventarioMovimiento[]
}

export interface InventarioReg01PDFProps {
  orgNombre: string
  ranchoNombre: string
  cultivo: string | null
  grupos: GrupoProductoReg01[]
  desde?: string
  hasta?: string
}

export function InventarioReg01PDF({
  orgNombre,
  ranchoNombre,
  cultivo,
  grupos,
  desde,
  hasta,
}: InventarioReg01PDFProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const rango = desde && hasta ? ` | ${desde} al ${hasta}` : ''

  return (
    <Document
      title="Inventario de Insumos — GlobalG.A.P. REG-01"
      subject={`REG-01 GlobalG.A.P. v6 - ${ranchoNombre}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      keywords="MADY, inocuidad, GlobalGAP, REG-01, inventario"
    >
      <PaginaEstandar
        orientacion="portrait"
        titulo="INVENTARIO DE INSUMOS"
        subtitulo={`REG-01 · GlobalG.A.P. v6 | ${ranchoNombre}${rango}`}
        codigoFmt="GG-REG-01"
        folio={emision}
        emision={emision}
        tituloDatos="DATOS GENERALES"
        camposDatos={[
          { icono: 'usuario', etiqueta: 'Compañía', valor: v(orgNombre) },
          { icono: 'ubicacion', etiqueta: 'Rancho / Huerto', valor: v(ranchoNombre) },
          { etiqueta: 'Cultivo', valor: v(cultivo) },
        ]}
      >
        <Text style={{ fontSize: 7, color: PC.textSub, fontFamily: 'Helvetica-Oblique', marginBottom: 6 }}>
          Inventario debe ser actualizado al menos semanalmente o cada que sea necesario.
        </Text>

        {grupos.map((g) => (
          <Seccion key={g.productoId} titulo={`${g.nombreComercial}${g.unidad ? ` | Unidad: ${g.unidad}` : ''}`.toUpperCase()}>
            <TablaDatos
              columnas={INV_COLS}
              anchoTotal={ANCHO_UTIL.portrait}
              vacio="Sin movimientos"
              filas={g.movimientos.map((m) => {
                const entrada =
                  m.tipo === 'entrada' ? fmtN(m.cantidad) : m.tipo === 'ajuste' ? `Aj. +${fmtN(m.cantidad)}` : ''
                const salida = m.tipo === 'salida' ? fmtN(m.cantidad) : ''
                return [v(m.fecha), entrada, salida, fmtN(m.balance)]
              })}
            />
          </Seccion>
        ))}

        {grupos.length === 0 && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: PC.fieldLabel }}>
              Sin movimientos en el periodo seleccionado.
            </Text>
          </View>
        )}
      </PaginaEstandar>
    </Document>
  )
}
