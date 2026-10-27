import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, FileSpreadsheet, FileText, CalendarRange } from 'lucide-react'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { BottomSheet } from '@/app/components/BottomSheet'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { Etiqueta, type TonoEtiqueta } from '@/app/components/ui-mady/Etiqueta'
import { TarjetaContador } from '@/app/components/ui-mady/TarjetaContador'
import { Boton } from '@/app/components/ui-mady/Boton'
import { useConfirmar } from '@/app/components/ui-mady/ConfirmarSheet'
import { nomina, useNomConfig, useNomConsolidadoMes, useNomConsolidadosLista } from '@/hooks/useNomina'
import { useConexion } from '@/hooks/useConexion'
import { avisarErrorNomina } from '@/lib/nomina/errores'
import { hoyMX } from '@/lib/fecha'
import { fechaHoraPdf, fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'
import { etiquetaMetodo, formatoMoneda } from '@/lib/nomina/formato'
import { CampoTexto, CampoTextoLargo, CuerpoSheet, MotivoSheet } from './ui'
import type {
  ConsolidadoCorte, ConsolidadoDatos, ConsolidadoIncidencia, ConsolidadoLista, ConsolidadoTrabajador,
} from '@/types/nomina.types'

// ───────────── Meses ('YYYY-MM') ─────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function sumarMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number)
  const t = a * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}
function etiquetaMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return `${MESES[m - 1]} ${a}`
}
const mesDeFecha = (f: string) => f.slice(0, 7)
const primerDia = (mes: string) => `${mes}-01`

const ESTADO: Record<ConsolidadoLista['estado'], { texto: string; tono: TonoEtiqueta }> = {
  borrador: { texto: 'Borrador', tono: 'neutral' },
  finalizado: { texto: 'Finalizado', tono: 'menta' },
  sustituido: { texto: 'Sustituido', tono: 'neutral' },
}
const ENTREGA: Record<ConsolidadoLista['entrega_estado'], string> = {
  no_entregado: 'Sin entregar',
  entrega_registrada: 'Entrega registrada',
  acuse_registrado: 'Acuse registrado',
}

type Pestana = 'trabajadores' | 'dinero' | 'cortes'

// ───────────── Pantalla ─────────────

export function NominaMensual() {
  const navigate = useNavigate()
  const { offline } = useConexion()
  const hoy = hoyMX()
  const mesActual = mesDeFecha(hoy)
  const { datos: config } = useNomConfig()
  const mesArranque = config?.fecha_arranque ? mesDeFecha(config.fecha_arranque) : null

  const [mes, setMes] = useState<string | null>(null)
  // Por defecto el mes anterior si ya hay datos (el arranque es anterior al mes actual); si no, el actual.
  useEffect(() => {
    if (mes || !config) return
    const anterior = sumarMeses(mesActual, -1)
    setMes(mesArranque && mesArranque <= anterior ? anterior : mesActual)
  }, [config, mes, mesActual, mesArranque])

  const mesSel = mes ?? mesActual
  const previa = useNomConsolidadoMes(mes ? primerDia(mes) : '')
  const lista = useNomConsolidadosLista()
  const revisiones = useMemo(
    () => lista.datos.filter(r => mesDeFecha(r.mes) === mesSel).sort((a, b) => b.revision - a.revision),
    [lista.datos, mesSel],
  )
  const hayFinalizada = revisiones.some(r => r.estado === 'finalizado')

  const [pestana, setPestana] = useState<Pestana>('trabajadores')
  const [generando, setGenerando] = useState(false)
  const [finalizando, setFinalizando] = useState<ConsolidadoLista | null>(null)
  const [entregando, setEntregando] = useState<ConsolidadoLista | null>(null)
  const [descargando, setDescargando] = useState<string | null>(null)
  const { confirmar, confirmarElemento } = useConfirmar()

  const d = previa.datos
  const moneda = d?.moneda ?? 'MXN'
  const enCurso = mesSel >= mesActual
  const bloqueantes = (d?.incidencias ?? []).filter(i => i.bloquea)
  const otras = (d?.incidencias ?? []).filter(i => !i.bloquea)
  const preliminar = !!d && (d.preliminar || d.en_curso)

  async function recargarTodo() {
    await Promise.all([previa.recargar(), lista.recargar()])
  }

  async function generar() {
    setGenerando(true)
    try {
      const r = await nomina.generarConsolidado(primerDia(mesSel))
      toast.success(r.repetido ? `Ya existía la revisión ${r.revision}: no hubo cambios` : `Revisión ${r.revision} generada`)
      await lista.recargar()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo generar la revisión')
    } finally {
      setGenerando(false)
    }
  }

  async function finalizar(r: ConsolidadoLista, motivo: string | null) {
    const res = await nomina.finalizarConsolidado(r.id, motivo)
    toast.success(`Revisión ${res.revision} finalizada`)
    await recargarTodo()
  }

  async function pedirFinalizar(r: ConsolidadoLista) {
    if (hayFinalizada) { setFinalizando(r); return }
    const ok = await confirmar({
      titulo: `Finalizar la revisión ${r.revision}`,
      descripcion: `Quedará como la versión oficial de ${etiquetaMes(mesSel)}. Si después hay movimientos tendrás que generar una revisión nueva.`,
      textoConfirmar: 'Finalizar',
    })
    if (!ok) return
    try {
      await finalizar(r, null)
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo finalizar la revisión')
    }
  }

  async function descargar(r: ConsolidadoLista, formato: 'pdf' | 'excel') {
    setDescargando(`${r.id}-${formato}`)
    try {
      const guardado = await nomina.consolidadoGuardado(r.id)
      if (formato === 'pdf') {
        const { generarConsolidadoMensualPDF } = await import('@/lib/pdf/m81/generarConsolidadoMensualPDF')
        await generarConsolidadoMensualPDF(guardado)
      } else {
        const { generarConsolidadoMensualExcel } = await import('@/lib/excel/generarConsolidadoMensualExcel')
        await generarConsolidadoMensualExcel(guardado)
      }
    } catch (e) {
      avisarErrorNomina(e, formato === 'pdf' ? 'No se pudo generar el PDF' : 'No se pudo generar el Excel')
    } finally {
      setDescargando(null)
    }
  }

  const puedeAnterior = !mesArranque || mesSel > mesArranque
  const puedeSiguiente = mesSel < mesActual

  return (
    <div className="min-h-full pb-safe-nav">
      <ModuloHeader tituloFallback="Consolidado mensual" forzarTitulo="Consolidado mensual" onBack={() => navigate('/nomina')} />

      <div className="px-4 py-4 space-y-4 max-w-6xl mx-auto">
        {offline && (
          <p className="rounded-xl bg-agro-info-fill text-agro-info-text text-xs px-3 py-2">
            Sin conexión: este módulo requiere internet para consultar y guardar.
          </p>
        )}

        <div className="flex items-center justify-between gap-2 max-w-3xl mx-auto">
          <Boton variante="icono" aria-label="Mes anterior" disabled={!puedeAnterior} onClick={() => setMes(sumarMeses(mesSel, -1))}>
            <ChevronLeft className="size-5" />
          </Boton>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground capitalize">{etiquetaMes(mesSel)}</p>
            {mesSel !== mesActual && (
              <button type="button" className="text-xs text-primary underline" onClick={() => setMes(mesActual)}>Mes actual</button>
            )}
          </div>
          <Boton variante="icono" aria-label="Mes siguiente" disabled={!puedeSiguiente} onClick={() => setMes(sumarMeses(mesSel, 1))}>
            <ChevronRight className="size-5" />
          </Boton>
        </div>

        {previa.error && (
          <div className="rounded-xl bg-agro-danger-fill text-agro-danger-text text-sm px-3 py-3 space-y-2 max-w-3xl mx-auto">
            <p>{previa.error}</p>
            <Boton tamano="sm" variante="secundario" onClick={() => void previa.recargar()}>Reintentar</Boton>
          </div>
        )}

        {d && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <Etiqueta tono={preliminar ? 'sky' : 'menta'}>{preliminar ? 'Preliminar' : 'Listo para finalizar'}</Etiqueta>
              <span className="text-xs text-muted-foreground">
                {fechaPdf(d.desde)} al {fechaPdf(d.hasta)} · al {fechaHoraPdf(d.as_of)}
              </span>
            </div>
            {preliminar && (
              <p className="rounded-xl bg-agro-info-fill text-agro-info-text text-xs px-3 py-2">
                {d.en_curso
                  ? 'El mes aún no termina: las cifras pueden cambiar.'
                  : 'Hay cortes del mes sin aprobar: las cifras son preliminares.'}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <TarjetaContador etiqueta="Reconocido (neto de cortes aprobados)" valor={d.resumen.neto_reconocido} format={n => formatoMoneda(n, moneda)} />
              <TarjetaContador etiqueta="Entregado (dinero pagado)" valor={d.resumen.entregado_total} format={n => formatoMoneda(n, moneda)} />
              <TarjetaContador
                etiqueta="Por pagar al cierre"
                valor={d.resumen.por_pagar_final}
                format={n => formatoMoneda(n, moneda)}
                tono={d.resumen.por_pagar_final > 0 ? 'info' : 'normal'}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Anticipos sin aplicar al cierre: {formatoMoneda(d.resumen.anticipos_sin_aplicar_final, moneda)} · Préstamos al cierre:{' '}
              {formatoMoneda(d.resumen.prestamos_final, moneda)}
            </p>

            <Incidencias bloqueantes={bloqueantes} otras={otras} />

            <div role="tablist" className="flex gap-2 overflow-x-auto">
              {([
                ['trabajadores', `Trabajadores (${d.trabajadores.length})`],
                ['dinero', `Dinero del mes (${d.movimientos.length})`],
                ['cortes', `Cortes del mes (${d.cortes.length})`],
              ] as [Pestana, string][]).map(([k, t]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={pestana === k}
                  onClick={() => setPestana(k)}
                  className={`h-9 px-3 rounded-full text-sm font-semibold whitespace-nowrap border ${
                    pestana === k ? 'bg-primary text-primary-foreground border-primary' : 'border-border-control text-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {pestana === 'trabajadores' && <ListaTrabajadores filas={d.trabajadores} moneda={moneda} />}
            {pestana === 'dinero' && <ListaDinero datos={d} />}
            {pestana === 'cortes' && <ListaCortes filas={d.cortes} moneda={moneda} />}
          </>
        )}

        {!d && !previa.cargando && !previa.error && (
          <EstadoVacio icono={CalendarRange} titulo="Sin información" ayuda="No hay datos para este mes." />
        )}

        <section className="space-y-3 max-w-3xl mx-auto">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Revisiones de {etiquetaMes(mesSel)}</h2>
            <Boton tamano="sm" cargando={generando} disabled={offline || !d} onClick={() => void generar()}>Generar revisión</Boton>
          </div>
          <p className="text-xs text-muted-foreground">
            El PDF y el Excel salen de una revisión guardada, para que lo entregado sea exactamente lo guardado.
          </p>
          {revisiones.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay revisiones de este mes.</p>}
          {revisiones.map(r => {
            const est = ESTADO[r.estado]
            const motivoNoFinalizar = r.preliminar ? 'Revisión preliminar: aprueba los cortes pendientes y genera otra.'
              : enCurso ? 'El mes aún no termina.'
              : bloqueantes.length > 0 ? 'Hay incidencias que bloquean.' : null
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Revisión {r.revision}</p>
                  <div className="flex gap-1.5">
                    {r.preliminar && <Etiqueta tono="sky">Preliminar</Etiqueta>}
                    <Etiqueta tono={est.tono}>{est.texto}</Etiqueta>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Generada {fechaHoraPdf(r.generado_en)}{r.generado_por ? ` por ${r.generado_por}` : ''}
                  {r.finalizado_en && <> · Finalizada {fechaHoraPdf(r.finalizado_en)}</>}
                </p>
                {r.estado === 'finalizado' && (
                  <p className="text-xs text-muted-foreground">
                    {ENTREGA[r.entrega_estado]}
                    {r.entregado_a && <> · a {r.entregado_a}</>}
                    {r.entregado_en && <> · {fechaPdf(r.entregado_en)}</>}
                    {r.acuse_en && <> · acuse {fechaPdf(r.acuse_en)}</>}
                  </p>
                )}
                {r.estado === 'finalizado' && r.fuentes_actualizadas && (
                  <p className="rounded-lg bg-agro-danger-fill text-agro-danger-text text-xs px-3 py-2">
                    Hubo movimientos después de finalizar: genera una nueva revisión.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Boton tamano="sm" variante="secundario" cargando={descargando === `${r.id}-pdf`} disabled={offline} onClick={() => void descargar(r, 'pdf')}>
                    <FileText className="size-4" /> PDF
                  </Boton>
                  <Boton tamano="sm" variante="secundario" cargando={descargando === `${r.id}-excel`} disabled={offline} onClick={() => void descargar(r, 'excel')}>
                    <FileSpreadsheet className="size-4" /> Excel
                  </Boton>
                  {r.estado === 'borrador' && (
                    <Boton tamano="sm" disabled={offline || !!motivoNoFinalizar} onClick={() => void pedirFinalizar(r)}>Finalizar</Boton>
                  )}
                  {r.estado === 'finalizado' && (
                    <Boton tamano="sm" disabled={offline} onClick={() => setEntregando(r)}>Registrar entrega</Boton>
                  )}
                </div>
                {r.estado === 'borrador' && motivoNoFinalizar && <p className="text-xs text-muted-foreground">{motivoNoFinalizar}</p>}
              </div>
            )
          })}
        </section>
      </div>

      {finalizando && (
        <MotivoSheet
          titulo={`Finalizar la revisión ${finalizando.revision}`}
          descripcion={`Ya hay una revisión finalizada de ${etiquetaMes(mesSel)}. Esta la sustituirá; escribe el motivo.`}
          etiqueta="Motivo de la sustitución"
          textoConfirmar="Finalizar y sustituir"
          onConfirmar={motivo => finalizar(finalizando, motivo)}
          onClose={() => setFinalizando(null)}
        />
      )}
      {entregando && (
        <EntregaSheet
          revision={entregando}
          onClose={() => setEntregando(null)}
          onListo={async () => { setEntregando(null); await lista.recargar() }}
        />
      )}
      {confirmarElemento}
    </div>
  )
}

// ───────────── Incidencias ─────────────

/** Saca de `detalle` (forma libre) el trabajador y la semana para enlazar a esa semana. */
function enlaceIncidencia(i: ConsolidadoIncidencia): { texto: string; to: string | null } | null {
  const det = Array.isArray(i.detalle) ? i.detalle : i.detalle ? [i.detalle] : []
  const items = det.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
  if (items.length === 0) return null
  const x = items[0]
  const trab = (x.trabajador_id ?? x.trabajador) as string | undefined
  const semana = (x.semana_inicio ?? x.semana ?? x.fecha) as string | undefined
  const nombre = [x.codigo, x.nombre].filter(Boolean).join(' · ')
  const texto = [nombre, semana ? `semana ${fechaPdf(semana)}` : null, items.length > 1 ? `y ${items.length - 1} más` : null]
    .filter(Boolean).join(' · ')
  return { texto, to: trab && semana ? `/nomina/semana/${trab}?fecha=${semana}` : null }
}

function Incidencias({ bloqueantes, otras }: { bloqueantes: ConsolidadoIncidencia[]; otras: ConsolidadoIncidencia[] }) {
  if (bloqueantes.length + otras.length === 0) return null
  const fila = (i: ConsolidadoIncidencia, k: number, clase: string) => {
    const e = enlaceIncidencia(i)
    return (
      <div key={`${i.codigo}-${k}`} className={`rounded-xl text-sm px-3 py-2 ${clase}`}>
        <p>{i.mensaje}</p>
        {e && (e.to
          ? <Link to={e.to} className="text-xs underline">{e.texto}</Link>
          : <p className="text-xs">{e.texto}</p>)}
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {bloqueantes.map((i, k) => fila(i, k, 'bg-agro-danger-fill text-agro-danger-text'))}
      {otras.map((i, k) => fila(i, k, 'bg-agro-info-fill text-agro-info-text'))}
    </div>
  )
}

// ───────────── Trabajadores ─────────────

function Renglon({ etiqueta, valor, moneda, negrita }: { etiqueta: string; valor: number; moneda: string; negrita?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 text-xs ${negrita ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
      <span>{etiqueta}</span><span className="tabular-nums">{formatoMoneda(valor, moneda)}</span>
    </div>
  )
}

function ListaTrabajadores({ filas, moneda }: { filas: ConsolidadoTrabajador[]; moneda: string }) {
  if (filas.length === 0) return <p className="text-sm text-muted-foreground">No hay trabajadores.</p>
  return (
    <>
      <div className="md:hidden space-y-3">
        {filas.map(t => (
          <div key={t.trabajador_id} className="rounded-xl border border-border bg-card p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{t.nombre}</p>
                <p className="text-xs text-muted-foreground">{t.codigo}{t.puesto ? ` · ${t.puesto}` : ''}</p>
              </div>
              {t.sin_movimiento && <span className="text-xs text-muted-foreground">Sin movimiento</span>}
            </div>
            {!t.sin_movimiento && (
              <>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">Reconocido</p>
                  <Renglon etiqueta="Percepciones" valor={t.reconocido.percepciones} moneda={moneda} />
                  <Renglon etiqueta="Reembolsos" valor={t.reconocido.reembolsos} moneda={moneda} />
                  <Renglon etiqueta="Descuentos" valor={t.reconocido.deducciones} moneda={moneda} />
                  <Renglon etiqueta="Neto" valor={t.reconocido.neto} moneda={moneda} negrita />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">Entregado</p>
                  <Renglon etiqueta="Pagos y anticipos" valor={t.entregado.pagos + t.entregado.anticipos} moneda={moneda} />
                  <Renglon etiqueta="Reversiones" valor={t.entregado.reversiones} moneda={moneda} />
                  <Renglon etiqueta="Total" valor={t.entregado.total} moneda={moneda} negrita />
                  <Renglon etiqueta="Aplicado a cortes" valor={t.aplicado_a_cortes} moneda={moneda} />
                </div>
              </>
            )}
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">Saldos (inicial → final)</p>
              <Renglon etiqueta={`Por pagar (inicial ${formatoMoneda(t.inicial.por_pagar, moneda)})`} valor={t.final.por_pagar} moneda={moneda} negrita />
              <Renglon etiqueta={`Anticipos sin aplicar (inicial ${formatoMoneda(t.inicial.anticipos_sin_aplicar, moneda)})`} valor={t.final.anticipos_sin_aplicar} moneda={moneda} />
              <Renglon etiqueta={`Préstamos (inicial ${formatoMoneda(t.inicial.prestamos, moneda)})`} valor={t.final.prestamos} moneda={moneda} />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-xs tabular-nums">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th rowSpan={2} className="text-left p-2 font-semibold">Trabajador</th>
              <th colSpan={3} className="p-2 font-semibold border-l border-border">Inicial</th>
              <th colSpan={4} className="p-2 font-semibold border-l border-border">Reconocido</th>
              <th colSpan={2} className="p-2 font-semibold border-l border-border">Entregado</th>
              <th rowSpan={2} className="p-2 font-semibold border-l border-border text-right">Aplicado</th>
              <th colSpan={3} className="p-2 font-semibold border-l border-border">Final</th>
            </tr>
            <tr>
              {['Por pagar', 'Anticipos', 'Préstamos', 'Percepciones', 'Reembolsos', 'Descuentos', 'Neto', 'Total', 'Reversiones', 'Por pagar', 'Anticipos', 'Préstamos']
                .map((h, i) => <th key={i} className={`p-2 font-semibold text-right ${[0, 3, 7, 10].includes(i) ? 'border-l border-border' : ''}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filas.map(t => (
              <tr key={t.trabajador_id} className={`border-t border-border ${t.sin_movimiento ? 'text-muted-foreground' : 'text-foreground'}`}>
                <td className="p-2 text-left">
                  <span className="font-semibold">{t.nombre}</span>
                  <span className="block text-muted-foreground">{t.codigo}{t.sin_movimiento ? ' · Sin movimiento' : ''}</span>
                </td>
                {[
                  t.inicial.por_pagar, t.inicial.anticipos_sin_aplicar, t.inicial.prestamos,
                  t.reconocido.percepciones, t.reconocido.reembolsos, t.reconocido.deducciones, t.reconocido.neto,
                  t.entregado.total, t.entregado.reversiones, t.aplicado_a_cortes,
                  t.final.por_pagar, t.final.anticipos_sin_aplicar, t.final.prestamos,
                ].map((n, i) => (
                  <td key={i} className={`p-2 text-right ${[0, 3, 7, 9, 10].includes(i) ? 'border-l border-border' : ''}`}>{formatoMoneda(n, moneda)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ───────────── Dinero y cortes ─────────────

const TIPO_MOV: Record<string, string> = { pago: 'Pago', anticipo: 'Anticipo', reversion: 'Reversión' }

function ListaDinero({ datos }: { datos: ConsolidadoDatos }) {
  if (datos.movimientos.length === 0) return <p className="text-sm text-muted-foreground">No hubo dinero entregado en el mes.</p>
  return (
    <div className="space-y-2">
      {datos.movimientos.map(m => (
        <div key={m.pago_id} className="rounded-xl border border-border bg-card p-3">
          <div className="flex justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{m.nombre} <span className="font-normal text-muted-foreground">{m.codigo}</span></p>
            <p className={`text-sm font-semibold tabular-nums ${m.monto < 0 ? 'text-agro-danger-text' : 'text-foreground'}`}>{formatoMoneda(m.monto, datos.moneda)}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {TIPO_MOV[m.tipo] ?? m.tipo} · {fechaPdf(m.fecha_pago)}{m.metodo ? ` · ${etiquetaMetodo(m.metodo)}` : ''}
            {m.folio_corte ? ` · Corte ${m.folio_corte}` : ''}
            {m.semana_inicio ? ` · Semana ${fechaPdf(m.semana_inicio)}` : ''}
          </p>
          {m.motivo && <p className="text-xs text-muted-foreground">Motivo: {m.motivo}</p>}
        </div>
      ))}
    </div>
  )
}

function ListaCortes({ filas, moneda }: { filas: ConsolidadoCorte[]; moneda: string }) {
  if (filas.length === 0) return <p className="text-sm text-muted-foreground">No hubo cortes aprobados ni anulados en el mes.</p>
  return (
    <div className="space-y-2">
      {filas.map((c, i) => (
        <div key={`${c.folio}-${c.evento}-${i}`} className="rounded-xl border border-border bg-card p-3">
          <div className="flex justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{c.nombre} <span className="font-normal text-muted-foreground">{c.codigo}</span></p>
            <p className={`text-sm font-semibold tabular-nums ${c.evento === 'anulado' ? 'text-agro-danger-text' : 'text-foreground'}`}>{formatoMoneda(c.neto, moneda)}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {c.folio} · {c.evento === 'anulado' ? 'Anulado' : 'Aprobado'} {fechaPdf(c.fecha)} · Semana {fechaPdf(c.semana_inicio)} al {fechaPdf(c.semana_fin)}
          </p>
          {c.motivo && <p className="text-xs text-muted-foreground">Motivo: {c.motivo}</p>}
        </div>
      ))}
    </div>
  )
}

// ───────────── Registrar entrega ─────────────

function EntregaSheet({ revision, onClose, onListo }: { revision: ConsolidadoLista; onClose: () => void; onListo: () => Promise<void> }) {
  const hoy = hoyMX()
  const [para, setPara] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [canal, setCanal] = useState('')
  const [acuse, setAcuse] = useState('')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const acuseMalo = acuse !== '' && acuse < fecha

  async function guardar() {
    setGuardando(true)
    try {
      await nomina.registrarEntregaConsolidado({
        id: revision.id, entregadoA: para.trim(), entregadoEn: fecha, canal: canal.trim() || null,
        acuseEn: acuse || null, nota: nota.trim() || null,
      })
      toast.success('Entrega registrada')
      await onListo()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo registrar la entrega')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} height="85%" title={`Registrar entrega · revisión ${revision.revision}`}>
      <CuerpoSheet textoGuardar="Registrar entrega" onGuardar={guardar} cargando={guardando} deshabilitado={!para.trim() || !fecha || acuseMalo}>
        <p className="text-xs text-muted-foreground">Solo deja constancia de a quién y cuándo se entregó; no envía nada.</p>
        <CampoTexto etiqueta="Entregado a" valor={para} onChange={setPara} maxLength={120} requerido />
        <CampoTexto etiqueta="Fecha de entrega" tipo="date" valor={fecha} onChange={setFecha} max={hoy} requerido />
        <CampoTexto etiqueta="Canal" valor={canal} onChange={setCanal} maxLength={80} placeholder="Correo, en mano, etc." />
        <CampoTexto
          etiqueta="Fecha de acuse"
          tipo="date"
          valor={acuse}
          onChange={setAcuse}
          min={fecha}
          max={hoy}
          error={acuseMalo ? 'El acuse no puede ser anterior a la entrega' : undefined}
        />
        <CampoTextoLargo etiqueta="Nota" valor={nota} onChange={setNota} />
      </CuerpoSheet>
    </BottomSheet>
  )
}
