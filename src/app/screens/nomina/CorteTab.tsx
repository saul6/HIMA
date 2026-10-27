import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Undo2 } from 'lucide-react'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Etiqueta, type TonoEtiqueta } from '@/app/components/ui-mady/Etiqueta'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { FilaRegistro } from '@/app/components/ui-mady/FilaRegistro'
import { useConfirmar } from '@/app/components/ui-mady/ConfirmarSheet'
import { useConexion } from '@/hooks/useConexion'
import { nomina, type useNomCalculo, type useNomPrestamos } from '@/hooks/useNomina'
import { avisarErrorNomina } from '@/lib/nomina/errores'
import { etiquetaMetodo, fechaCorta, formatoMoneda, r2 } from '@/lib/nomina/formato'
import { fechaHora } from '@/lib/formato'
import { AjusteSheet, PagoSheet, ReversionSheet } from './SheetsDinero'
import { CLASE_INPUT, MotivoSheet, leerNumero } from './ui'
import type { CtxSemana } from './contexto'
import type {
  CalculoCorte, CorteAprobado, LineaCorte, NomAjuste, NomPagoFila, OrigenTarifa, PagoResumen, TipoLinea,
} from '@/types/nomina.types'

const ORIGEN: Record<OrigenTarifa, string> = {
  perfil: 'modalidad base',
  trabajador: 'tarifa personal',
  organizacion: 'tarifa general',
  pactado: 'pactado',
}

const GRUPOS: { tipo: TipoLinea; titulo: string }[] = [
  { tipo: 'percepcion', titulo: 'Percepciones' },
  { tipo: 'reembolso', titulo: 'Reembolsos' },
  { tipo: 'deduccion', titulo: 'Descuentos' },
  { tipo: 'informativa', titulo: 'Informativas (no suman)' },
]

export function estadoPagoEtiqueta(p: PagoResumen | undefined): { texto: string; tono: TonoEtiqueta } {
  switch (p?.estado_pago) {
    case 'pagado': return { texto: 'Pagado', tono: 'menta' }
    case 'parcial': return { texto: 'Pago parcial', tono: 'sky' }
    case 'sin_importe': return { texto: 'Sin importe', tono: 'neutral' }
    default: return { texto: 'Pendiente de pago', tono: 'sky' }
  }
}

function Lineas({ lineas, moneda }: { lineas: LineaCorte[]; moneda: string }) {
  return (
    <div className="space-y-4">
      {GRUPOS.map(g => {
        const items = lineas.filter(l => l.tipo === g.tipo)
        if (items.length === 0) return null
        return (
          <div key={g.tipo}>
            <TituloSeccion variante="subtitulo" className="mb-1">{g.titulo}</TituloSeccion>
            {items.map((l, i) => (
              <FilaRegistro
                key={`${l.orden}-${i}`}
                icono={null}
                titulo={l.concepto}
                subtitulo={[l.fecha ? fechaCorta(l.fecha) : null, l.formula, l.origen_tarifa ? ORIGEN[l.origen_tarifa] : null]
                  .filter(Boolean).join(' · ')}
                derecha={
                  g.tipo === 'informativa'
                    ? <Etiqueta tono="neutral">No suma</Etiqueta>
                    : <span className="text-sm font-semibold tabular-nums">
                        {g.tipo === 'deduccion' ? '−' : ''}{formatoMoneda(Math.abs(l.monto), moneda)}
                      </span>
                }
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function Totales({ t, moneda, extra }: {
  t: CalculoCorte['totales']
  moneda: string
  extra?: React.ReactNode
}) {
  const fila = (e: string, v: number, fuerte = false) => (
    <div className={`flex justify-between text-sm ${fuerte ? 'font-semibold text-base' : ''}`}>
      <span className={fuerte ? '' : 'text-muted-foreground'}>{e}</span>
      <span className="tabular-nums">{formatoMoneda(v, moneda)}</span>
    </div>
  )
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
      {fila('Percepciones', t.percepciones)}
      {fila('Reembolsos', t.reembolsos)}
      {fila('Descuentos', t.deducciones)}
      <div className="border-t border-border my-1" />
      {fila('Neto de la semana', t.neto, true)}
      {extra}
    </div>
  )
}

interface Props {
  ctx: CtxSemana
  calculo: ReturnType<typeof useNomCalculo>
  prestamos: ReturnType<typeof useNomPrestamos>
  ajustes: NomAjuste[]
  /** Lleva a la pestaña Captura con la actividad que causa un bloqueo. */
  onIrActividad: (id: string) => void
  onCambio: () => Promise<void>
}

type Sheet =
  | { tipo: 'pago'; corteId: string; pendiente: number }
  | { tipo: 'revertir'; pagoId: string; maximo: number }
  | { tipo: 'ajuste'; corteId: string }
  | { tipo: 'anular-corte'; corteId: string }
  | { tipo: 'cancelar-ajuste'; id: string }
  | null

export function CorteTab({ ctx, calculo, prestamos, ajustes, onIrActividad, onCambio }: Props) {
  const { offline } = useConexion()
  const { confirmar, confirmarElemento } = useConfirmar()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [aprobando, setAprobando] = useState(false)
  // La llave de aprobación cambia solo cuando cambia el cálculo que se está viendo.
  const llaveAprobar = useRef<{ hash: string; llave: string } | null>(null)

  const resp = calculo.datos
  if (calculo.cargando && !resp) return <p className="text-sm text-muted-foreground py-6 text-center">Calculando…</p>
  if (calculo.error && !resp) {
    return (
      <div className="rounded-xl bg-agro-danger-fill text-agro-danger-text text-sm px-3 py-3 space-y-2">
        <p>{calculo.error}</p>
        <Boton tamano="sm" variante="secundario" onClick={() => void calculo.recargar()}>Reintentar</Boton>
      </div>
    )
  }
  if (!resp) return null

  async function aprobar(calc: CalculoCorte, periodoId: string) {
    const prestamo = calc.exceso_anticipo > 0
      ? ` Se registrará un préstamo por ${formatoMoneda(calc.exceso_anticipo, calc.moneda)}.`
      : ''
    const ok = await confirmar({
      titulo: 'Aprobar corte',
      descripcion:
        `Neto: ${formatoMoneda(calc.totales.neto, calc.moneda)}. ` +
        `Anticipos: ${formatoMoneda(calc.anticipos_sin_aplicar, calc.moneda)}.${prestamo} ` +
        'Un corte aprobado ya no se edita.',
      textoConfirmar: 'Aprobar',
    })
    if (!ok) return
    if (llaveAprobar.current?.hash !== calc.input_hash) {
      llaveAprobar.current = { hash: calc.input_hash, llave: crypto.randomUUID() }
    }
    setAprobando(true)
    try {
      const r = await nomina.aprobarCorte(ctx.trabajadorId, periodoId, calc.input_hash, llaveAprobar.current.llave)
      llaveAprobar.current = null
      toast.success(r.repetida ? 'El corte ya estaba aprobado' : `Corte aprobado · folio ${r.folio}`)
      await onCambio()
    } catch (e) {
      const codigo = avisarErrorNomina(e, 'No se pudo aprobar el corte')
      if (codigo === 'INPUTS_CHANGED') {
        toast.warning('Los datos cambiaron, revisa otra vez')
        await onCambio()
      }
    } finally {
      setAprobando(false)
    }
  }

  // ───── Borrador ─────
  if (!resp.aprobado) {
    const c = resp.calculo
    const periodoId = resp.periodo_id
    const bloqueado = c.bloqueos.length > 0
    return (
      <div className="space-y-5">
        {c.bloqueos.length > 0 && (
          <div className="rounded-xl border border-agro-red bg-agro-danger-fill p-3 space-y-2" role="alert">
            <p className="text-sm font-semibold text-agro-danger-text flex items-center gap-1.5">
              <AlertTriangle className="size-4" /> No se puede aprobar todavía
            </p>
            <ul className="space-y-1.5">
              {c.bloqueos.map((b, i) => (
                <li key={`${b.codigo}-${i}`} className="text-sm text-agro-danger-text flex items-start justify-between gap-2">
                  <span>{b.mensaje}</span>
                  {b.fuente_id && (
                    <button type="button" className="shrink-0 underline text-xs font-semibold" onClick={() => onIrActividad(b.fuente_id!)}>
                      Ver línea
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {c.avisos.map((a, i) => (
          <div
            key={`${a.codigo}-${i}`}
            className={`rounded-xl border p-3 text-sm ${
              a.rojo ? 'border-agro-red bg-agro-danger-fill text-agro-danger-text font-semibold' : 'border-agro-menta bg-agro-info-fill text-agro-info-text'
            }`}
          >
            <p>{a.mensaje}</p>
            {a.codigo === 'DIAS_SIN_ASISTENCIA' && a.fechas && a.fechas.length > 0 && (
              <p className="text-xs mt-1">Días: {a.fechas.map(fechaCorta).join(', ')}</p>
            )}
            {a.codigo === 'EXCESO_ANTICIPO' && a.monto != null && (
              <p className="text-xs mt-1">Se hará préstamo por {formatoMoneda(a.monto, c.moneda)}.</p>
            )}
          </div>
        ))}

        {c.lineas.length === 0
          ? <p className="text-sm text-muted-foreground text-center py-4">Sin líneas en esta semana.</p>
          : <Lineas lineas={c.lineas} moneda={c.moneda} />}

        <Totales
          t={c.totales}
          moneda={c.moneda}
          extra={
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Anticipos</span>
                <span className="tabular-nums">{formatoMoneda(c.anticipos_sin_aplicar, c.moneda)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>Pendiente estimado</span>
                <span className="tabular-nums">{formatoMoneda(c.pendiente_estimado, c.moneda)}</span>
              </div>
              {c.exceso_anticipo > 0 && (
                <div className="flex justify-between text-sm font-semibold text-agro-danger-text">
                  <span>Exceso de anticipo (préstamo)</span>
                  <span className="tabular-nums">{formatoMoneda(c.exceso_anticipo, c.moneda)}</span>
                </div>
              )}
            </>
          }
        />

        <Boton
          className="w-full"
          cargando={aprobando}
          disabled={bloqueado || offline || !periodoId}
          onClick={() => periodoId && void aprobar(c, periodoId)}
        >
          Aprobar corte
        </Boton>
        {bloqueado && <p className="text-xs text-agro-danger-text text-center">Resuelve los pendientes de arriba para aprobar.</p>}
        <PrestamosSeccion ctx={ctx} prestamos={prestamos} onCambio={onCambio} />
        {confirmarElemento}
      </div>
    )
  }

  // ───── Aprobado ─────
  const corte: CorteAprobado = resp.corte
  const snap = corte.calculo
  const moneda = snap?.moneda ?? ctx.moneda
  const est = estadoPagoEtiqueta(corte.pago)
  const pagos = corte.pagos ?? []
  const noRevertido = (p: NomPagoFila) =>
    r2(Number(p.monto) - pagos.filter(x => x.tipo === 'reversion' && x.revierte_pago_id === p.id).reduce((s, x) => s + Number(x.monto), 0))
  const ajustesCorte = ajustes.filter(a => a.corte_origen_id === corte.id)
  const sinPagos = !pagos.some(p => p.tipo === 'pago' || p.tipo === 'anticipo')

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Folio NOM-{String(corte.folio).padStart(6, '0')}</p>
          <Etiqueta tono={est.tono}>{est.texto}</Etiqueta>
        </div>
        <p className="text-xs text-muted-foreground">Aprobado el {fechaHora(corte.aprobado_en)}</p>
      </div>

      {snap && <Lineas lineas={snap.lineas} moneda={moneda} />}
      {snap && (
        <Totales
          t={snap.totales}
          moneda={moneda}
          extra={
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Entregado</span>
                <span className="tabular-nums">{formatoMoneda(corte.pago.entregado, moneda)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>Pendiente</span>
                <span className="tabular-nums">{formatoMoneda(corte.pago.pendiente, moneda)}</span>
              </div>
              {corte.pago.exceso_anticipo > 0 && (
                <div className="flex justify-between text-sm font-semibold text-agro-danger-text">
                  <span>Exceso de anticipo (préstamo)</span>
                  <span className="tabular-nums">{formatoMoneda(corte.pago.exceso_anticipo, moneda)}</span>
                </div>
              )}
            </>
          }
        />
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <TituloSeccion className="mb-0">Pagos</TituloSeccion>
          {corte.pago.pendiente > 0 && (
            <Boton tamano="sm" disabled={offline} onClick={() => setSheet({ tipo: 'pago', corteId: corte.id, pendiente: corte.pago.pendiente })}>
              Registrar pago
            </Boton>
          )}
        </div>
        {pagos.length === 0 && <p className="text-sm text-muted-foreground py-2">Sin pagos registrados.</p>}
        {pagos.map(p => {
          const rev = p.tipo === 'reversion'
          const max = noRevertido(p)
          return (
            <FilaRegistro
              key={p.id}
              icono={null}
              titulo={rev ? 'Reversión' : p.tipo === 'anticipo' ? 'Anticipo' : 'Pago'}
              subtitulo={`${fechaCorta(p.fecha_pago)} · ${etiquetaMetodo(p.metodo)}${p.referencia ? ` · ${p.referencia}` : ''}${rev && p.motivo ? ` · ${p.motivo}` : ''}`}
              derecha={<span className="text-sm font-semibold tabular-nums">{rev ? '−' : ''}{formatoMoneda(p.monto, moneda)}</span>}
              acciones={!rev && max > 0 && (
                <Boton variante="icono" aria-label="Revertir pago" disabled={offline} onClick={() => setSheet({ tipo: 'revertir', pagoId: p.id, maximo: max })}>
                  <Undo2 className="size-4" />
                </Boton>
              )}
            />
          )
        })}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <TituloSeccion className="mb-0">Ajustes</TituloSeccion>
          <Boton tamano="sm" variante="secundario" disabled={offline} onClick={() => setSheet({ tipo: 'ajuste', corteId: corte.id })}>
            Crear ajuste
          </Boton>
        </div>
        {ajustesCorte.length === 0 && <p className="text-sm text-muted-foreground py-2">Sin ajustes. Se aplican en la siguiente semana que se apruebe.</p>}
        {ajustesCorte.map(a => (
          <FilaRegistro
            key={a.id}
            icono={null}
            titulo={a.tipo === 'a_favor' ? 'A favor del trabajador' : 'En contra del trabajador'}
            subtitulo={a.motivo}
            derecha={
              <span className="flex items-center gap-2">
                <Etiqueta tono={a.estado === 'aplicado' ? 'menta' : a.estado === 'cancelado' ? 'neutral' : 'pendiente'}>
                  {a.estado === 'aplicado' ? 'Aplicado' : a.estado === 'cancelado' ? 'Cancelado' : 'Pendiente'}
                </Etiqueta>
                <span className="text-sm font-semibold tabular-nums">{formatoMoneda(a.monto, moneda)}</span>
              </span>
            }
            acciones={a.estado === 'pendiente' && (
              <Boton tamano="sm" variante="secundario" disabled={offline} onClick={() => setSheet({ tipo: 'cancelar-ajuste', id: a.id })}>
                Cancelar
              </Boton>
            )}
          />
        ))}
      </section>

      <PrestamosSeccion ctx={ctx} prestamos={prestamos} onCambio={onCambio} />

      {sinPagos ? (
        <Boton variante="secundario" className="w-full" disabled={offline} onClick={() => setSheet({ tipo: 'anular-corte', corteId: corte.id })}>
          Anular corte
        </Boton>
      ) : (
        <p className="text-xs text-muted-foreground text-center">Un corte con pagos no se anula: corrígelo con un ajuste.</p>
      )}

      {sheet?.tipo === 'pago' && <PagoSheet ctx={{ ...ctx, recargar: onCambio }} corteId={sheet.corteId} pendiente={sheet.pendiente} onClose={() => setSheet(null)} />}
      {sheet?.tipo === 'revertir' && <ReversionSheet ctx={{ ...ctx, recargar: onCambio }} pagoId={sheet.pagoId} maximo={sheet.maximo} onClose={() => setSheet(null)} />}
      {sheet?.tipo === 'ajuste' && <AjusteSheet ctx={{ ...ctx, recargar: onCambio }} corteId={sheet.corteId} onClose={() => setSheet(null)} />}
      {sheet?.tipo === 'anular-corte' && (
        <MotivoSheet
          titulo="Anular corte"
          descripcion="El corte volverá a borrador y podrás editar la semana."
          textoConfirmar="Anular corte"
          onClose={() => setSheet(null)}
          onConfirmar={async motivo => {
            await nomina.anularCorte(sheet.corteId, motivo)
            toast.success('Corte anulado')
            await onCambio()
          }}
        />
      )}
      {sheet?.tipo === 'cancelar-ajuste' && (
        <MotivoSheet
          titulo="Cancelar ajuste"
          textoConfirmar="Cancelar ajuste"
          onClose={() => setSheet(null)}
          onConfirmar={async motivo => {
            await nomina.cancelarAjuste(sheet.id, motivo)
            toast.success('Ajuste cancelado')
            await onCambio()
          }}
        />
      )}
      {confirmarElemento}
    </div>
  )
}

function PrestamosSeccion({ ctx, prestamos, onCambio }: {
  ctx: CtxSemana
  prestamos: ReturnType<typeof useNomPrestamos>
  onCambio: () => Promise<void>
}) {
  const { offline } = useConexion()
  const activos = prestamos.datos.filter(p => p.estado === 'activo')
  if (activos.length === 0) return null
  return (
    <section>
      <TituloSeccion>Préstamos activos</TituloSeccion>
      <div className="space-y-2">
        {activos.map(p => (
          <FilaPrestamo key={p.id} prestamo={p} moneda={ctx.moneda} deshabilitado={offline} onGuardado={onCambio} />
        ))}
      </div>
    </section>
  )
}

function FilaPrestamo({ prestamo, moneda, deshabilitado, onGuardado }: {
  prestamo: ReturnType<typeof useNomPrestamos>['datos'][number]
  moneda: string
  deshabilitado: boolean
  onGuardado: () => Promise<void>
}) {
  const [cuota, setCuota] = useState(prestamo.cuota_semanal != null ? String(prestamo.cuota_semanal) : '')
  const [guardando, setGuardando] = useState(false)
  const valor = leerNumero(cuota)
  const cambio = (cuota.trim() === '' ? null : valor) !== (prestamo.cuota_semanal ?? null)

  async function guardar() {
    setGuardando(true)
    try {
      await nomina.prestamoCuota(prestamo.id, cuota.trim() === '' ? null : r2(valor))
      toast.success('Cuota actualizada')
      await onGuardado()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo guardar la cuota')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Saldo</span>
        <span className="font-semibold tabular-nums text-agro-danger-text">{formatoMoneda(prestamo.saldo, moneda)}</span>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={`cuota-${prestamo.id}`}>Cuota semanal</label>
          <input
            id={`cuota-${prestamo.id}`}
            inputMode="decimal"
            value={cuota}
            placeholder="Todo lo posible"
            onChange={e => setCuota(e.target.value)}
            className={CLASE_INPUT}
          />
        </div>
        <Boton
          tamano="md"
          variante="secundario"
          cargando={guardando}
          disabled={deshabilitado || !cambio || (cuota.trim() !== '' && !(valor > 0))}
          onClick={() => void guardar()}
        >
          Guardar
        </Boton>
      </div>
      <p className="text-xs text-muted-foreground">Vacío = recuperar todo lo posible cada semana.</p>
    </div>
  )
}
