// PDF M81 — Consolidado mensual de nómina administrativa y pagos (diseño nuevo, A4 horizontal).
// Registro administrativo interno: todo importe sale tal cual lo guardó el servidor en la revisión.

import { Document, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion, fechaEmisionHoy } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { TablaDatos, ANCHO_UTIL, type CeldaDato, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { fechaHoraPdf, fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'
import { PC } from '@/lib/pdf/components/tokens'
import { etiquetaMetodo, formatoMoneda } from '@/lib/nomina/formato'
import type { ConsolidadoGuardado } from '@/types/nomina.types'

const ANCHO = ANCHO_UTIL.landscape

export const folioConsolidado = (c: Pick<ConsolidadoGuardado, 'datos' | 'revision'>) =>
  `NOM-MENSUAL-${c.datos.mes} · R${c.revision}`

export function estadoConsolidado(c: ConsolidadoGuardado): string {
  if (c.datos.preliminar || c.datos.en_curso || c.preliminar) return 'PRELIMINAR'
  return c.estado === 'finalizado' ? 'Finalizado' : c.estado === 'sustituido' ? 'Sustituido' : 'Borrador'
}

const TIPO_MOV: Record<string, string> = { pago: 'Pago', anticipo: 'Anticipo', reversion: 'Reversión' }

export function ConsolidadoMensualPagina({ consolidado: c }: { consolidado: ConsolidadoGuardado }) {
  const d = c.datos
  const m = d.moneda
  const $ = (n: number) => formatoMoneda(n, m)
  const neg = (n: number): CeldaDato => (n < 0 ? { texto: $(n), color: PC.negativo } : $(n))
  const r = d.resumen

  const colsTrab: ColumnaDato[] = [
    { texto: 'Trabajador', ancho: 3.4, align: 'left' },
    ...['Por pagar', 'Anticipos', 'Préstamos', 'Percepciones', 'Reembolsos', 'Descuentos', 'Neto', 'Total', 'Reversiones', 'Aplicado',
      'Por pagar', 'Anticipos', 'Préstamos'].map((texto) => ({ texto, ancho: 1.6, align: 'right' as const })),
  ]

  return (
    <PaginaEstandar
      orientacion="landscape"
      titulo="CONSOLIDADO MENSUAL DE NÓMINA ADMINISTRATIVA Y PAGOS"
      subtitulo={`Consolidado mensual | ${d.organizacion}`}
      codigoFmt="Consolidado mensual"
      folio={folioConsolidado(c)}
      emision={fechaEmisionHoy()}
      tituloDatos="1. RESUMEN"
      porRenglon={4}
      camposDatos={[
        { icono: 'calendario', etiqueta: 'Periodo', valor: `${fechaPdf(d.desde)} al ${fechaPdf(d.hasta)}` },
        { etiqueta: 'Estado', valor: estadoConsolidado(c), colorValor: estadoConsolidado(c) === 'PRELIMINAR' ? PC.negativo : undefined },
        { icono: 'usuario', etiqueta: 'Trabajadores', valor: String(r.trabajadores) },
        { etiqueta: 'Reconocido (neto)', valor: $(r.neto_reconocido) },
        { etiqueta: 'Entregado', valor: $(r.entregado_total) },
        { etiqueta: 'Aplicado a cortes', valor: $(r.aplicado_a_cortes) },
        { etiqueta: 'Por pagar al cierre', valor: $(r.por_pagar_final) },
        { etiqueta: 'Anticipos sin aplicar', valor: $(r.anticipos_sin_aplicar_final) },
        { etiqueta: 'Préstamos al cierre', valor: $(r.prestamos_final) },
        { etiqueta: 'Traspaso a préstamo', valor: $(r.traspaso_a_prestamo) },
      ]}
    >
      <Seccion titulo="2. TRABAJADORES">
        <TablaDatos
          columnas={colsTrab}
          anchoTotal={ANCHO}
          fuente={7}
          fuenteEnc={6.5}
          encabezadoSuperior={[
            { texto: '', ancho: 3.4 },
            { texto: 'Inicial', ancho: 4.8 },
            { texto: 'Reconocido', ancho: 6.4 },
            { texto: 'Entregado', ancho: 3.2 },
            { texto: 'Aplicado', ancho: 1.6 },
            { texto: 'Final', ancho: 4.8 },
          ]}
          vacio="Sin trabajadores"
          filas={d.trabajadores.map((t) => [
            { texto: `${t.nombre} (${t.codigo})${t.sin_movimiento ? ' - sin movimiento' : ''}`, color: t.sin_movimiento ? PC.fieldLabel : undefined },
            $(t.inicial.por_pagar), $(t.inicial.anticipos_sin_aplicar), $(t.inicial.prestamos),
            $(t.reconocido.percepciones), $(t.reconocido.reembolsos), $(t.reconocido.deducciones),
            { texto: $(t.reconocido.neto), negrita: true },
            $(t.entregado.total), neg(t.entregado.reversiones), $(t.aplicado_a_cortes),
            { texto: $(t.final.por_pagar), negrita: true }, $(t.final.anticipos_sin_aplicar), $(t.final.prestamos),
          ])}
        />
      </Seccion>

      <Seccion titulo="3. DINERO DEL MES">
        <TablaDatos
          columnas={[
            { texto: 'Fecha de pago', ancho: 1.2, align: 'left' },
            { texto: 'Trabajador', ancho: 3, align: 'left' },
            { texto: 'Tipo', ancho: 1.2, align: 'left' },
            { texto: 'Método', ancho: 1.2, align: 'left' },
            { texto: 'Referencia', ancho: 1.6, align: 'left' },
            { texto: 'Corte', ancho: 1.6, align: 'left' },
            { texto: 'Semana', ancho: 1.2, align: 'left' },
            { texto: 'Monto', ancho: 1.4, align: 'right' },
            { texto: 'Motivo', ancho: 2.4, align: 'left' },
          ]}
          anchoTotal={ANCHO}
          vacio="Sin dinero entregado en el mes"
          filas={d.movimientos.map((x) => [
            fechaPdf(x.fecha_pago),
            `${x.nombre} (${x.codigo})`,
            TIPO_MOV[x.tipo] ?? x.tipo,
            etiquetaMetodo(x.metodo),
            x.referencia ?? '',
            x.folio_corte ?? '',
            x.semana_inicio ? fechaPdf(x.semana_inicio) : '',
            neg(x.monto),
            x.motivo ?? '',
          ])}
        />
      </Seccion>

      <Seccion titulo="4. CORTES DEL MES">
        <TablaDatos
          columnas={[
            { texto: 'Folio', ancho: 1.6, align: 'left' },
            { texto: 'Trabajador', ancho: 3, align: 'left' },
            { texto: 'Evento', ancho: 1.1, align: 'left' },
            { texto: 'Fecha', ancho: 1.2, align: 'left' },
            { texto: 'Semana', ancho: 2, align: 'left' },
            { texto: 'Percepciones', ancho: 1.4, align: 'right' },
            { texto: 'Reembolsos', ancho: 1.4, align: 'right' },
            { texto: 'Descuentos', ancho: 1.4, align: 'right' },
            { texto: 'Neto', ancho: 1.4, align: 'right' },
            { texto: 'Motivo', ancho: 2, align: 'left' },
          ]}
          anchoTotal={ANCHO}
          vacio="Sin cortes aprobados ni anulados en el mes"
          filas={d.cortes.map((x) => {
            const anulado = x.evento === 'anulado'
            const imp = (n: number): CeldaDato => (anulado ? { texto: $(n), color: PC.negativo } : $(n))
            return [
              x.folio,
              `${x.nombre} (${x.codigo})`,
              anulado ? 'Anulado' : 'Aprobado',
              fechaPdf(x.fecha),
              `${fechaPdf(x.semana_inicio)} al ${fechaPdf(x.semana_fin)}`,
              imp(x.percepciones), imp(x.reembolsos), imp(x.deducciones), imp(x.neto),
              x.motivo ?? '',
            ]
          })}
        />
      </Seccion>

      <Seccion titulo="5. INCIDENCIAS">
        <TablaDatos
          columnas={[
            { texto: 'Tipo', ancho: 1.2, align: 'left' },
            { texto: 'Código', ancho: 2.4, align: 'left' },
            { texto: 'Mensaje', ancho: 8, align: 'left' },
          ]}
          anchoTotal={ANCHO}
          vacio="Sin incidencias"
          filas={d.incidencias.map((i) => [i.bloquea ? 'Bloquea' : 'Aviso', i.codigo, i.mensaje])}
        />
        <Text style={{ fontSize: 7, color: PC.fieldLabel, marginTop: 4 }}>
          Registro administrativo interno. Base: reconocido por fecha de aprobación del corte; entregado por fecha de pago.
          Estado de fuentes al {fechaHoraPdf(d.as_of)} (hora de CDMX).
        </Text>
      </Seccion>
    </PaginaEstandar>
  )
}

export function ConsolidadoMensualPDF({ consolidado }: { consolidado: ConsolidadoGuardado }) {
  return (
    <Document title={`Consolidado mensual ${consolidado.datos.mes}`} author="M.A.D.Y">
      <ConsolidadoMensualPagina consolidado={consolidado} />
    </Document>
  )
}
