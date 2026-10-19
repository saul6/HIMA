// PDF M38 — Manifiesto de embarque (diseño nuevo: lib/pdf/disenoNuevo).
import { Document, View, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, ANCHO_UTIL, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'
import type { FirmaParaPdf } from '@/hooks/useFirmasRegistro'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'

export interface M38LineaPDF {
  orden: number
  tarima: string
  producto: string
  presentacion: string
  cajas: number | null
  temp_superior: number | null
  temp_medio: number | null
  temp_inferior: number | null
}

export interface M38ManifiestoDataPDF {
  orgNombre: string
  instalacion: string
  fecha: string
  folio: string | null
  empresa: string | null
  linea_transportista: string | null
  nombre_chofer: string | null
  placas_tractor: string | null
  caja_pies: string | null
  econ_tractor: string | null
  econ_caja: string | null
  num_sello: string | null
  num_chismografo: string | null
  llegada_hora: string | null
  llegada_temp: number | null
  carga_hora: string | null
  carga_temp: number | null
  salida_hora: string | null
  salida_temp: number | null
  cond_buen_estado: boolean
  cond_limpio: boolean
  cond_presencia_plagas: boolean
  tar_remontado: string
  tar_flejado: string
  tar_limpieza: string
  tar_condicion: string
  tar_distribucion: string
  lineas: M38LineaPDF[]
  observaciones: string | null
}

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

const t = (v: string | null | undefined): string => v ?? '—'
const n = (v: number | null | undefined): string => v != null ? String(v) : '—'
const si = (v: boolean): string => v ? 'Si' : 'No'
const bm = (v: string): string => v === 'bueno' ? 'Bueno' : 'Malo'

const ANCHO_DERECHA = 195
const GAP = 12

const COLS_TARIMAS: ColumnaDato[] = [
  { texto: 'No.', ancho: 20, align: 'center' },
  { texto: 'Tarima', ancho: 38 },
  { texto: 'Producto', ancho: 150 },
  { texto: 'Presentacion', ancho: 60 },
  { texto: 'Cajas', ancho: 28, align: 'center' },
  { texto: 'T. Sup.', ancho: 34, align: 'center' },
  { texto: 'T. Med.', ancho: 34, align: 'center' },
  { texto: 'T. Inf.', ancho: 34, align: 'center' },
]

const COLS_TEMP: ColumnaDato[] = [
  { texto: 'Momento', ancho: 46 },
  { texto: 'Hora', ancho: 40 },
  { texto: 'Temp. (C)', ancho: 109 },
]

// Fila "etiqueta ........ valor" de las listas de condiciones; el valor malo sale en rojo suave
function FilaCondicion({ label, valor, malo }: { label: string; valor: string; malo: boolean }) {
  return (
    <View wrap={false} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: PC.border }}>
      <Text style={{ fontSize: 7.5, flex: 1, color: PC.fieldValue }}>{label}</Text>
      <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', width: 32, textAlign: 'right', color: malo ? PC.negativo : PC.m13Navy }}>{valor}</Text>
    </View>
  )
}

export function ManifiestoEmbarquePDF({
  d,
  codigoClave,
  terminoSitio = 'Instalación',
  firmaRealizo,
  firmaVerifico,
}: {
  d: M38ManifiestoDataPDF
  codigoClave: string
  terminoSitio?: string
  firmaRealizo?: FirmaParaPdf | null
  firmaVerifico?: FirmaParaPdf | null
}) {
  const codigoFmt = codigoFormato('F-FRUS-PRO-01', codigoClave)

  const totales: Record<string, number> = {}
  for (const l of d.lineas) {
    if (l.producto.trim()) {
      totales[l.producto.trim()] = (totales[l.producto.trim()] ?? 0) + (l.cajas ?? 0)
    }
  }

  return (
    <Document>
      <PaginaEstandar
        titulo="MANIFIESTO DE EMBARQUE"
        subtitulo={`Embarque | ${d.instalacion} | ${fmtFecha(d.fecha)}`}
        codigoFmt={codigoFmt}
        folio={d.folio ?? '—'}
        emision={d.fecha}
        etiquetaEmision="Fecha"
        tituloDatos="DATOS DEL EMBARQUE"
        camposDatos={[
          { etiqueta: 'Empresa / Cliente', valor: t(d.empresa) },
          { etiqueta: 'Línea transportista', valor: t(d.linea_transportista) },
          { icono: 'usuario', etiqueta: 'Nombre del chofer', valor: t(d.nombre_chofer) },
          { etiqueta: 'Placas del tractor', valor: t(d.placas_tractor) },
          { etiqueta: 'Caja (pies)', valor: t(d.caja_pies) },
          { etiqueta: 'Economico tractor', valor: t(d.econ_tractor) },
          { etiqueta: 'Economico caja', valor: t(d.econ_caja) },
          { etiqueta: 'No. sello', valor: t(d.num_sello) },
          { etiqueta: 'No. chismografo', valor: t(d.num_chismografo) },
        ]}
      >
        {/* Cuerpo principal: tarimas (izquierda) + datos del camión y listas (derecha) */}
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: GAP }}>
            <Seccion titulo="TARIMAS EMBARCADAS">
              <TablaDatos
                columnas={COLS_TARIMAS}
                anchoTotal={ANCHO_UTIL.landscape - ANCHO_DERECHA - GAP}
                fuente={7.5}
                filas={d.lineas.map((l) => [
                  String(l.orden), l.tarima, l.producto, l.presentacion, n(l.cajas), n(l.temp_superior), n(l.temp_medio), n(l.temp_inferior),
                ])}
              />
            </Seccion>

            {Object.keys(totales).length > 0 && (
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.m13Navy, marginBottom: 2 }}>Total por producto</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {Object.entries(totales).map(([prod, cajas], i) => (
                    <Text key={i} style={{ fontSize: 7.5, color: PC.fieldValue, marginRight: 10 }}>
                      {prod}: {cajas} cjs
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {d.observaciones && (
              <View style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: PC.m13Navy, marginBottom: 2 }}>Observaciones</Text>
                <Text style={{ fontSize: 7.5, color: PC.fieldValue }} hyphenationCallback={partirPalabraLarga}>{d.observaciones}</Text>
              </View>
            )}
          </View>

          {/* Columna derecha */}
          <View style={{ width: ANCHO_DERECHA }}>
            <Seccion titulo="TEMPERATURA DEL CAMION">
              <TablaDatos
                columnas={COLS_TEMP}
                anchoTotal={ANCHO_DERECHA}
                fuente={7.5}
                encabezadoFijo={false}
                filas={[
                  ['Llegada', t(d.llegada_hora), n(d.llegada_temp)],
                  ['Carga', t(d.carga_hora), n(d.carga_temp)],
                  ['Salida', t(d.salida_hora), n(d.salida_temp)],
                ]}
              />
            </Seccion>

            <Seccion titulo="CONDICIONES DEL TRANSPORTE">
              <View style={{ marginBottom: 10 }}>
                <FilaCondicion label="En buen estado" valor={si(d.cond_buen_estado)} malo={!d.cond_buen_estado} />
                <FilaCondicion label="Limpio y sin malos olores" valor={si(d.cond_limpio)} malo={!d.cond_limpio} />
                <FilaCondicion label="Presencia de plagas" valor={si(d.cond_presencia_plagas)} malo={d.cond_presencia_plagas} />
              </View>
            </Seccion>

            <Seccion titulo="CONDICIONES DE LAS TARIMAS">
              <View>
                <FilaCondicion label="Remontado" valor={bm(d.tar_remontado)} malo={bm(d.tar_remontado) === 'Malo'} />
                <FilaCondicion label="Flejado" valor={bm(d.tar_flejado)} malo={bm(d.tar_flejado) === 'Malo'} />
                <FilaCondicion label="Limpieza" valor={bm(d.tar_limpieza)} malo={bm(d.tar_limpieza) === 'Malo'} />
                <FilaCondicion label="Condición de la tarima" valor={bm(d.tar_condicion)} malo={bm(d.tar_condicion) === 'Malo'} />
                <FilaCondicion label="Distribucion embarque" valor={bm(d.tar_distribucion)} malo={bm(d.tar_distribucion) === 'Malo'} />
              </View>
            </Seccion>
          </View>
        </View>

        {/* Firmas */}
        <PdfFirmas
          signatures={[
            { label: 'Responsable de la instalacion', nombre: firmaRealizo?.firmante ?? '', caption: 'Firma del responsable', firma: firmaRealizo ?? null },
            { label: 'Responsable de la empresa', nombre: firmaVerifico?.firmante ?? '', caption: 'Responsable de Inocuidad — Firma', firma: firmaVerifico ?? null },
            { label: 'Firma del chofer', nombre: '', caption: 'Firma del conductor' },
          ]}
        />
      </PaginaEstandar>
    </Document>
  )
}
