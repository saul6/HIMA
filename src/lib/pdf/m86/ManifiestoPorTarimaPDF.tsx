// PDF M86 — Manifiesto de embarque (formato PRO-01). Diseño nuevo (lib/pdf/disenoNuevo).
// Renglón por presentación de cada tarima CARGADA (una tarima con dos presentaciones = dos renglones, una tarima).
// Temperaturas de fruta solo de tarimas medidas; si hay más de una terna, todas van en el anexo de lecturas.
// Totales por producto sin recortar: si hay más de cinco, siguen numerados (continuación del mismo manifiesto).
import { Document, View, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { TablaDatos, type ColumnaDato, type CeldaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'
import type { M86Detalle } from '@/hooks/useM86Manifiesto'
import { horaLocal, fechaLocal, fmtT, totalesPorPresentacion } from './manifiestoLogica'

const ANCHO = 841.89 - 80
const X: CeldaDato = { texto: 'X', negrita: true }
const XNeg: CeldaDato = { texto: 'X', negrita: true, color: PC.negativo }

function hora(iso: string | null, base: string | null) {
  if (!iso) return ''
  const f = fechaLocal(iso)
  return horaLocal(iso) + (base && f !== fechaLocal(base) ? ` (${fechaPdf(f)})` : '')
}

const ESTADO_TXT: Record<string, string> = {
  BORRADOR: 'Borrador', LLEGADA_INSPECCIONADA: 'Llegada inspeccionada', EN_CARGA: 'En carga', CARGA_COMPLETA: 'Carga completa',
  PENDIENTE_CONFORMIDADES: 'Pendiente de conformidades', CIERRE_LOCAL_SELLO_PENDIENTE: 'Cierre local · sello pendiente por consolidado',
  CERRADO: 'Cerrado', SUSPENDIDO: 'Suspendido',
}

export function ManifiestoPorTarimaPDF({ d, orgNombre, codigoClave }: { d: M86Detalle; orgNombre: string; codigoClave: string }) {
  const { m } = d
  const u = `°${m.temp_unidad}`
  const codigoFmt = codigoFormato('F-FRUS-PRO-01', codigoClave)
  const fecha = fechaPdf(m.fecha)
  const cargadas = d.tarimas.filter(t => t.estado === 'CARGADA')
  const retiradas = d.tarimas.filter(t => t.estado === 'RETIRADA')
  const totales = totalesPorPresentacion(d.tarimas)
  const totalCajas = totales.reduce((a, t) => a + t.cajas, 0)
  const primera = d.muestras[0] ?? null

  const colsTarimas: ColumnaDato[] = [
    { texto: 'Tarima', ancho: 45, align: 'center' },
    { texto: 'Orgánico / Convencional', ancho: 60, align: 'center' },
    { texto: 'Producto', ancho: 70 },
    { texto: 'Presentación', ancho: 170 },
    { texto: 'Cajas', ancho: 45, align: 'center' },
    { texto: 'Cotejo de retención', ancho: 75, align: 'center' },
  ]
  const cotejo = (t: M86Detalle['tarimas'][number]) => t.papeleta_id ? `PRO-07 liberada${t.papeleta_codigo ? ` #${t.papeleta_codigo}` : ''}` : t.cotejo_retencion ? 'Manual' : ''
  const prodDe = (t: any, codigo: string) => { const p = Array.from(new Set(((t.origen ?? []) as any[]).filter(o => o.codigo === codigo).map(o => o.codigo_productor))).join(', '); return p ? ` · Prod. ${p}` : '' }
  const filasTarimas: CeldaDato[][] = cargadas.flatMap(t => t.lineas.map(l => [t.numero, t.clasificacion, l.fruta ?? '', `${l.presentacion} (#${l.codigo})${prodDe(t, l.codigo)}`, String(l.cajas), cotejo(t)]))

  const siNo = (v: boolean | null, conforme: boolean): [CeldaDato, CeldaDato] =>
    v === null ? ['', ''] : v ? [v === conforme ? X : XNeg, ''] : ['', v === conforme ? X : XNeg]
  const buenoMalo = (v: boolean | null): [CeldaDato, CeldaDato] => (v === null ? ['', ''] : v ? [X, ''] : ['', XNeg])

  return (
    <Document>
      <PaginaEstandar
        trio={false}
        titulo="MANIFIESTO DE EMBARQUE"
        subtitulo={orgNombre}
        codigoFmt={codigoFmt}
        folio={m.folio ?? 'Sin folio confirmado'}
        emision={fecha}
        detalleCompacto={`${codigoFmt}  |  N° ${m.folio ?? 'Sin folio confirmado'}  |  ${fecha}`}
        camposDatos={[
          { icono: 'codigo', etiqueta: 'Formato', valor: codigoFmt },
          { etiqueta: 'Empresa', valor: m.empresa },
          { icono: 'calendario', etiqueta: 'Fecha', valor: fecha },
          { etiqueta: 'N°', valor: m.folio ?? 'Sin folio confirmado' },
          ...(m.estado !== 'CERRADO' ? [{ etiqueta: 'Estado', valor: ESTADO_TXT[m.estado] ?? m.estado, colorValor: PC.negativo }] : []),
        ]}
      >
        <Seccion titulo="TRANSPORTE">
          <FranjaDatos porRenglon={4} anchoTotal={ANCHO} campos={[
            { etiqueta: 'Línea transportista', valor: m.transportista ?? '' },
            { etiqueta: 'Nombre del chofer', valor: m.chofer ?? '' },
            { etiqueta: 'Placas del tractor', valor: m.tractor_placas ?? '' },
            { etiqueta: 'N° econ. del tractor', valor: m.tractor_economico ?? '' },
            { etiqueta: 'Caja (pies)', valor: m.caja_pies ?? '' },
            { etiqueta: 'N° econ. de la caja', valor: m.caja_economico ?? '' },
            { etiqueta: 'N° de sello', valor: m.sello_estado === 'COLOCADO' ? (m.sello_folio ?? '') : m.sello_estado === 'PENDIENTE_CONSOLIDADO' ? 'Pendiente por consolidado' : '' },
            { etiqueta: 'N° de chismógrafo', valor: m.termografo_folio ?? '' },
          ]} />
        </Seccion>

        <Seccion titulo="TARIMAS CARGADAS">
          <TablaDatos columnas={colsTarimas} filas={filasTarimas} fuente={7.5} vacio="Sin tarimas cargadas" />
          <Text style={{ fontSize: 7, color: PC.textSub, marginTop: 3 }}>
            {cargadas.length} tarima(s) físicas · {filasTarimas.length} renglones · {totalCajas} cajas. Cotejo de retención: verificación manual en sitio (no es detección automática). Nota: Especificar si el producto es Orgánico (ORG) o Convencional (CONV).
          </Text>
        </Seccion>

        <View wrap={false} style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <TablaDatos anchoTotal={175} encabezadoFijo={false} fuente={7.5}
              columnas={[{ texto: `Temperatura de la fruta${primera ? ` · primera tarima muestreada, n.º ${primera.tarima_numero}` : ' · sin muestreo'}`, ancho: 110 }, { texto: u, ancho: 50, align: 'center' }]}
              filas={[['Superior', primera ? fmtT(primera.superior) : ''], ['Medio', primera ? fmtT(primera.medio) : ''], ['Inferior', primera ? fmtT(primera.inferior) : '']]} />
            {d.muestras.length > 1 && <Text style={{ fontSize: 6.5, color: PC.textSub, marginTop: 2 }}>Las demás lecturas ({d.muestras.length - 1}) corresponden al anexo de este manifiesto. No es un promedio.</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <TablaDatos anchoTotal={175} encabezadoFijo={false} fuente={7.5}
              columnas={[{ texto: 'Camión', ancho: 50 }, { texto: 'Hora', ancho: 60, align: 'center' }, { texto: `Temperatura ${u}`, ancho: 60, align: 'center' }]}
              filas={[
                ['Llegada', hora(m.llegada_en, null), fmtT(m.llegada_temp)],
                ['Carga', hora(m.carga_en, m.llegada_en), fmtT(m.carga_temp)],
                ['Salida', hora(m.salida_en, m.llegada_en), fmtT(m.salida_temp)],
              ]} />
          </View>
          <View style={{ flex: 1 }}>
            <TablaDatos anchoTotal={175} encabezadoFijo={false} fuente={7.5}
              columnas={[{ texto: 'Condiciones del transporte', ancho: 120 }, { texto: 'Si', ancho: 25, align: 'center' }, { texto: 'No', ancho: 25, align: 'center' }]}
              filas={[
                ['En buen estado', ...siNo(m.it_buen_estado, true)],
                ['Limpio y libre de malos olores', ...siNo(m.it_limpio, true)],
                ['Presencia de plagas', ...siNo(m.it_plagas, false)],
              ]} />
          </View>
          <View style={{ flex: 1 }}>
            <TablaDatos anchoTotal={175} encabezadoFijo={false} fuente={7.5}
              columnas={[{ texto: 'Condiciones de las tarimas', ancho: 110 }, { texto: 'Bueno', ancho: 30, align: 'center' }, { texto: 'Malo', ancho: 30, align: 'center' }]}
              filas={[
                ['Remontado correcto', ...buenoMalo(m.itar_remontado)],
                ['Flejado correcto', ...buenoMalo(m.itar_flejado)],
                ['Condiciones de limpieza', ...buenoMalo(m.itar_limpieza)],
                ['Condición de la tarima', ...buenoMalo(m.itar_condicion)],
                ['Distribución del embarque', ...buenoMalo(m.itar_distribucion)],
              ]} />
          </View>
        </View>

        <View wrap={false} style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <TablaDatos anchoTotal={350} encabezadoFijo={false} fuente={7.5}
              columnas={[{ texto: 'Total producto', ancho: 70 }, { texto: 'Presentación', ancho: 190 }, { texto: 'Cajas', ancho: 50, align: 'center' }]}
              filas={[
                ...(totales.length ? totales : [null, null, null, null, null]).map((t, i): CeldaDato[] =>
                  [`${i + 1}${i >= 5 ? ' (continuación)' : ''}`, t ? `${t.presentacion} (#${t.codigo}) · ${t.clasificacion}` : '', t ? String(t.cajas) : '']),
                [{ texto: 'Total general', negrita: true }, { texto: `${totales.length} producto(s) · ${cargadas.length} tarima(s)`, negrita: true }, { texto: String(totalCajas), negrita: true }],
              ]} />
          </View>
          <View style={{ flex: 1 }}>
            <FranjaDatos porRenglon={1} anchoTotal={350} margenInferior={0} campos={[{ etiqueta: 'Observaciones', valor: m.observaciones ?? ' ' }]} />
          </View>
        </View>

        <PdfFirmas
          signatures={[
            { label: '', nombre: m.conf_emergent_nombre ?? '', caption: `Responsable ${orgNombre}\nFirmo de conformidad`, firma: null },
            { label: '', nombre: m.conf_cliente_nombre ?? '', caption: 'Responsable Empresa\nFirmo de conformidad', firma: null },
            { label: '', nombre: m.conf_chofer_nombre ?? '', caption: 'Firma del Chofer\nFirmo de conformidad', firma: null },
          ]}
        />
        <Text style={{ fontSize: 6.5, color: PC.textSub, marginTop: 4 }}>
          Los nombres son conformidades registradas en M.A.D.Y.; la firma manuscrita está en el papel{m.papel_resguardo ? ` (resguardo: ${m.papel_resguardo})` : ' (resguardo pendiente de registrar)'}.
        </Text>

        {m.sello_estado === 'PENDIENTE_CONSOLIDADO' && (
          <View wrap={false} style={{ marginTop: 8 }}>
            <Seccion titulo="SEGUIMIENTO DEL SELLO (EVIDENCIA POSTERIOR)">
              {d.evidencias.length === 0
                ? <Text style={{ fontSize: 7.5, color: PC.negativo }}>Sello pendiente por consolidado: evidencia final pendiente. El cierre documental no está completo.</Text>
                : <TablaDatos fuente={7} encabezadoFijo={false}
                    columnas={[{ texto: 'Recibida en M.A.D.Y.', ancho: 70, align: 'center' }, { texto: 'Fecha informada', ancho: 55, align: 'center' }, { texto: 'N° de sello', ancho: 55 },
                      { texto: 'Unidad', ancho: 55 }, { texto: 'Informa', ancho: 90 }, { texto: 'Soporte', ancho: 150 }, { texto: 'Estado', ancho: 110 }]}
                    filas={d.evidencias.map(e => [`${fechaPdf(fechaLocal(e.recibido_en))} ${horaLocal(e.recibido_en)}`, e.fecha_informada ? fechaPdf(e.fecha_informada) : '',
                      e.sello_folio, e.unidad_referencia, e.informa, e.soporte,
                      e.estado === 'VERIFICADA' ? `Verificada por ${e.verifico ?? ''}` : e.estado === 'RECHAZADA' ? { texto: `No corresponde: ${e.nota ?? ''}`, color: PC.negativo } : 'Por verificar'])} />}
              <Text style={{ fontSize: 6.5, color: PC.textSub, marginTop: 2 }}>Evento posterior y separado: no modifica los datos ni la fecha de salida de este manifiesto.</Text>
            </Seccion>
          </View>
        )}

        {(d.muestras.length > 1 || retiradas.length > 0) && (
          <View break>
            {d.muestras.length > 1 && (
              <Seccion titulo="ANEXO · LECTURAS DE TEMPERATURA POR TARIMA">
                <TablaDatos fuente={7.5}
                  columnas={[{ texto: 'Orden', ancho: 35, align: 'center' }, { texto: 'Tarima', ancho: 50, align: 'center' }, { texto: 'Hora', ancho: 50, align: 'center' },
                    { texto: `Superior ${u}`, ancho: 60, align: 'center' }, { texto: `Medio ${u}`, ancho: 60, align: 'center' }, { texto: `Inferior ${u}`, ancho: 60, align: 'center' },
                    { texto: 'Capturó', ancho: 120 }]}
                  filas={d.muestras.map((s, i) => [`${i + 1}${i === 0 ? ' (recuadro)' : ''}`, s.tarima_numero, horaLocal(s.medida_en), fmtT(s.superior), fmtT(s.medio), fmtT(s.inferior), s.capturo ?? ''])} />
              </Seccion>
            )}
            {retiradas.length > 0 && (
              <Seccion titulo="ANEXO · TARIMAS RETIRADAS (RECTIFICACIONES)">
                <TablaDatos fuente={7.5}
                  columnas={[{ texto: 'Tarima', ancho: 50, align: 'center' }, { texto: 'Contenido', ancho: 220 }, { texto: 'Retirada', ancho: 60, align: 'center' }, { texto: 'Motivo', ancho: 200 }]}
                  filas={retiradas.map(t => [t.numero, t.lineas.map(l => `#${l.codigo} ×${l.cajas}`).join(', '), horaLocal(t.retirada_en), t.retiro_motivo ?? ''])} />
              </Seccion>
            )}
          </View>
        )}
      </PaginaEstandar>
    </Document>
  )
}
