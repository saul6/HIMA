import { Document } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'

export interface ProductoAutorizadoRow {
  cultivo: string
  ingrediente_activo: string
  nombre_comercial: string
  concentracion: string
  empresa: string
  dosis_ha: string
  intervalo_seguridad_dias: number | null
  plagas_control: string
  mercado: string
}

interface Props {
  orgNombre: string
  productos: ProductoAutorizadoRow[]
  codigoClave: string
  cultivoFiltro?: string | null
  fecha?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}

// Anchos relativos de columna (la tabla se escala al ancho útil de la hoja)
const COLS: ColumnaDato[] = [
  { texto: 'Ingrediente activo', ancho: 100 },
  { texto: 'Nombre comercial', ancho: 95 },
  { texto: 'Concentracion', ancho: 55 },
  { texto: 'Empresa', ancho: 80 },
  { texto: 'Dosis/ha', ancho: 50 },
  { texto: 'I.S.', ancho: 35, align: 'center' },
  { texto: 'Plagas que controla', ancho: 110 },
  { texto: 'Mercado', ancho: 55 },
]

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

export function ProductosAutorizadosPDF({ orgNombre, productos, codigoClave, cultivoFiltro, fecha, firmaRealizo, firmaVerifico }: Props) {
  const codigoFmt = codigoFormato('M66-PROD-AUT', codigoClave)
  const fechaDisplay = fecha ? fmtFecha(fecha) : new Date().toLocaleDateString('es-MX')

  // Agrupar por cultivo
  const cultivosUnicos = [...new Set(productos.map(p => p.cultivo))].sort()

  return (
    <Document>
      <PaginaEstandar
        titulo="LISTA DE PRODUCTOS AUTORIZADOS"
        subtitulo={`Plaguicidas y agroquimicos aprobados${cultivoFiltro ? ` | ${cultivoFiltro}` : ''}`}
        codigoFmt={codigoFmt}
        folio={fechaDisplay}
        emision={fechaDisplay}
        etiquetaEmision="Fecha"
        tituloDatos="1. INFORMACION GENERAL"
        camposDatos={[
          { icono: 'usuario', etiqueta: 'Organizacion', valor: orgNombre },
          { etiqueta: 'Cultivo', valor: cultivoFiltro ?? 'Todos' },
          { icono: 'calendario', etiqueta: 'Fecha de emision', valor: fechaDisplay },
        ]}
      >
        {cultivosUnicos.map((cultivo) => (
          <Seccion key={cultivo} titulo={cultivo.toUpperCase()}>
            <TablaDatos
              columnas={COLS}
              fuente={6.5}
              filas={productos.filter((p) => p.cultivo === cultivo).map((p) => [
                p.ingrediente_activo,
                p.nombre_comercial,
                p.concentracion,
                p.empresa,
                p.dosis_ha,
                p.intervalo_seguridad_dias != null ? `${p.intervalo_seguridad_dias}d` : '—',
                p.plagas_control,
                p.mercado,
              ])}
            />
          </Seccion>
        ))}

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
