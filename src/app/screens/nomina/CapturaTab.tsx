import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Plus, Repeat, Trash2, Undo2 } from 'lucide-react'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { FilaRegistro } from '@/app/components/ui-mady/FilaRegistro'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { useConfirmar } from '@/app/components/ui-mady/ConfirmarSheet'
import { useRanchos } from '@/hooks/useRanchos'
import { useConexion } from '@/hooks/useConexion'
import {
  nomina, useNomActividadesCatalogo, useNomConceptos, type useNomCaptura,
} from '@/hooks/useNomina'
import { avisarErrorNomina } from '@/lib/nomina/errores'
import { diaCorto, diasSemana, etiquetaMetodo, fechaCorta, formatoMoneda, r2 } from '@/lib/nomina/formato'
import { ActividadSheet, type InicialActividad } from './ActividadSheet'
import { AnticipoSheet, MovimientoSheet, ReversionSheet } from './SheetsDinero'
import { MotivoSheet } from './ui'
import type { CtxSemana } from './contexto'
import type { EstadoAsistencia, NomActividad, NomAsistencia } from '@/types/nomina.types'

const ESTADOS_ASISTENCIA: { valor: EstadoAsistencia; etiqueta: string }[] = [
  { valor: 'trabajado', etiqueta: 'Trabajado' },
  { valor: 'medio', etiqueta: 'Medio' },
  { valor: 'ausente', etiqueta: 'Ausente' },
  { valor: 'descanso', etiqueta: 'Descanso' },
  { valor: 'permiso_pagado', etiqueta: 'Permiso con goce' },
]

type Sheet =
  | { tipo: 'actividad'; editar?: NomActividad; inicial?: InicialActividad }
  | { tipo: 'anular-actividad'; act: NomActividad }
  | { tipo: 'movimiento' }
  | { tipo: 'anticipo' }
  | { tipo: 'revertir'; pagoId: string; maximo: number }
  | null

interface Props {
  ctx: CtxSemana
  /** Id de una actividad a abrir en edición (viene de un bloqueo del corte). */
  foco: string | null
  onFocoAtendido: () => void
  /** Se notifica cuando cambia la captura para que el corte se recalcule. */
  onCambio: () => Promise<void>
  captura: ReturnType<typeof useNomCaptura>
}

export function CapturaTab({ ctx, foco, onFocoAtendido, onCambio, captura }: Props) {
  const { offline } = useConexion()
  const { ranchos } = useRanchos()
  const { datos: catalogo } = useNomActividadesCatalogo()
  const { datos: conceptos } = useNomConceptos()
  const { confirmar, confirmarElemento } = useConfirmar()
  const [sheet, setSheet] = useState<Sheet>(null)
  const { actividades, asistencia, movimientos, anticipos } = captura.datos

  const bloqueada = ctx.aprobada
  const nombreActividad = (id: string) => catalogo.find(a => a.id === id)
  const nombreConcepto = (id: string) => conceptos.find(c => c.id === id)?.nombre ?? 'Concepto'

  // onCambio ya vuelve a pedir corte, captura y préstamos.
  const ctxCaptura: CtxSemana = { ...ctx, recargar: onCambio }

  // Un bloqueo del corte pide abrir la actividad que lo causa.
  useEffect(() => {
    if (!foco || bloqueada) { if (foco) onFocoAtendido(); return }
    const act = actividades.find(a => a.id === foco)
    if (act) { setSheet({ tipo: 'actividad', editar: act }); onFocoAtendido() }
  }, [foco, actividades, bloqueada, onFocoAtendido])

  const ultima = [...actividades].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0]

  const mostrarAsistencia = ctx.modalidad !== null && ctx.modalidad !== 'ninguna'
  const dias = diasSemana(ctx.lunes)

  async function marcar(fecha: string, estado: EstadoAsistencia | null, horas: number | null) {
    try {
      await nomina.marcarAsistencia(ctx.trabajadorId, fecha, estado, horas)
      await ctxCaptura.recargar()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo guardar la asistencia')
    }
  }

  async function anularMovimiento(id: string) {
    if (!(await confirmar({
      titulo: 'Anular concepto', descripcion: 'El concepto dejará de contar en el corte.',
      textoConfirmar: 'Anular', tono: 'peligro',
    }))) return
    try {
      await nomina.anularMovimiento(id)
      toast.success('Concepto anulado')
      await ctxCaptura.recargar()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo anular el concepto')
    }
  }

  const reversado = (pagoId: string) =>
    anticipos.filter(p => p.tipo === 'reversion' && p.revierte_pago_id === pagoId).reduce((s, p) => s + Number(p.monto), 0)

  return (
    <div className="space-y-6">
      {bloqueada && (
        <p className="rounded-xl bg-agro-info-fill text-agro-info-text text-sm px-3 py-2">
          Semana aprobada: corrige con un ajuste.
        </p>
      )}

      {/* Actividades */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <TituloSeccion className="mb-0">Actividades</TituloSeccion>
          {!bloqueada && (
            <div className="flex gap-2">
              {ultima && (
                <Boton
                  tamano="sm"
                  variante="secundario"
                  disabled={offline}
                  onClick={() => setSheet({
                    tipo: 'actividad',
                    inicial: { actividadId: ultima.actividad_id, cantidad: ultima.cantidad, ranchoId: ultima.rancho_id },
                  })}
                >
                  <Repeat className="size-4" /> Repetir última
                </Boton>
              )}
              <Boton tamano="sm" disabled={offline} onClick={() => setSheet({ tipo: 'actividad' })}>
                <Plus className="size-4" /> Actividad
              </Boton>
            </div>
          )}
        </div>
        {actividades.length === 0 && <p className="text-sm text-muted-foreground py-2">Sin actividades esta semana.</p>}
        {actividades.map(a => {
          const cat = nombreActividad(a.actividad_id)
          return (
            <FilaRegistro
              key={a.id}
              icono={null}
              titulo={cat?.nombre ?? 'Actividad'}
              subtitulo={`${diaCorto(a.fecha)} ${fechaCorta(a.fecha)}${a.nota ? ` · ${a.nota}` : ''}`}
              lineas={
                a.importe_pactado != null
                  ? <>Importe {formatoMoneda(a.importe_pactado, ctx.moneda)}{a.motivo_pactado ? ` · ${a.motivo_pactado}` : ''}</>
                  : <>{a.cantidad} {cat?.unidad ?? ''}</>
              }
              derecha={cat?.modo === 'informativa' ? <Etiqueta tono="neutral">No suma al pago</Etiqueta> : undefined}
              acciones={!bloqueada && (
                <>
                  <Boton variante="icono" aria-label="Editar actividad" disabled={offline} onClick={() => setSheet({ tipo: 'actividad', editar: a })}>
                    <Pencil className="size-4" />
                  </Boton>
                  <Boton variante="icono" aria-label="Anular actividad" disabled={offline} onClick={() => setSheet({ tipo: 'anular-actividad', act: a })}>
                    <Trash2 className="size-4" />
                  </Boton>
                </>
              )}
            />
          )
        })}
      </section>

      {/* Asistencia */}
      {mostrarAsistencia && (
        <section>
          <TituloSeccion>Asistencia</TituloSeccion>
          <div className="space-y-2">
            {dias.map(f => {
              const fuera = f < ctx.min || f > ctx.max
              const marca = asistencia.find(x => x.fecha === f)
              return (
                <FilaAsistencia
                  key={f}
                  fecha={f}
                  marca={marca}
                  deshabilitado={bloqueada || fuera || offline}
                  porHora={ctx.modalidad === 'hora'}
                  onMarcar={marcar}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* Conceptos */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <TituloSeccion className="mb-0">Conceptos</TituloSeccion>
          {!bloqueada && (
            <Boton tamano="sm" disabled={offline} onClick={() => setSheet({ tipo: 'movimiento' })}>
              <Plus className="size-4" /> Concepto
            </Boton>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-1">Bonos, descuento por ausencia, reembolsos y otros.</p>
        {movimientos.length === 0 && <p className="text-sm text-muted-foreground py-2">Sin conceptos.</p>}
        {movimientos.map(m => (
          <FilaRegistro
            key={m.id}
            icono={null}
            titulo={nombreConcepto(m.concepto_id)}
            subtitulo={m.motivo}
            derecha={<span className="text-sm font-semibold tabular-nums">{formatoMoneda(m.monto, ctx.moneda)}</span>}
            acciones={!bloqueada && (
              <Boton variante="icono" aria-label="Anular concepto" disabled={offline} onClick={() => void anularMovimiento(m.id)}>
                <Trash2 className="size-4" />
              </Boton>
            )}
          />
        ))}
      </section>

      {/* Anticipos */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <TituloSeccion className="mb-0">Anticipos</TituloSeccion>
          {!bloqueada && (
            <Boton tamano="sm" disabled={offline} onClick={() => setSheet({ tipo: 'anticipo' })}>
              <Plus className="size-4" /> Anticipo
            </Boton>
          )}
        </div>
        {anticipos.length === 0 && <p className="text-sm text-muted-foreground py-2">Sin anticipos esta semana.</p>}
        {anticipos.map(p => {
          const esRev = p.tipo === 'reversion'
          const restante = r2(Number(p.monto) - reversado(p.id))
          return (
            <FilaRegistro
              key={p.id}
              icono={null}
              titulo={esRev ? 'Reversión de anticipo' : 'Anticipo'}
              subtitulo={`${fechaCorta(p.fecha_pago)} · ${etiquetaMetodo(p.metodo)}${p.referencia ? ` · ${p.referencia}` : ''}${esRev && p.motivo ? ` · ${p.motivo}` : ''}`}
              derecha={
                <span className="text-sm font-semibold tabular-nums">
                  {esRev ? '−' : ''}{formatoMoneda(p.monto, ctx.moneda)}
                </span>
              }
              acciones={!bloqueada && !esRev && restante > 0 && (
                <Boton variante="icono" aria-label="Revertir anticipo" disabled={offline} onClick={() => setSheet({ tipo: 'revertir', pagoId: p.id, maximo: restante })}>
                  <Undo2 className="size-4" />
                </Boton>
              )}
            />
          )
        })}
      </section>

      {sheet?.tipo === 'actividad' && (
        <ActividadSheet
          ctx={ctxCaptura}
          catalogo={catalogo}
          ranchos={ranchos.map(r => ({ id: r.id, nombre: r.nombre }))}
          editar={sheet.editar}
          inicial={sheet.inicial}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.tipo === 'anular-actividad' && (
        <MotivoSheet
          titulo="Anular actividad"
          descripcion="La actividad dejará de contar en el corte."
          textoConfirmar="Anular"
          onClose={() => setSheet(null)}
          onConfirmar={async motivo => {
            await nomina.anularActividad(sheet.act.id, sheet.act.version, motivo)
            toast.success('Actividad anulada')
            await ctxCaptura.recargar()
          }}
        />
      )}
      {sheet?.tipo === 'movimiento' && <MovimientoSheet ctx={ctxCaptura} conceptos={conceptos} onClose={() => setSheet(null)} />}
      {sheet?.tipo === 'anticipo' && <AnticipoSheet ctx={ctxCaptura} onClose={() => setSheet(null)} />}
      {sheet?.tipo === 'revertir' && (
        <ReversionSheet ctx={ctxCaptura} pagoId={sheet.pagoId} maximo={sheet.maximo} onClose={() => setSheet(null)} />
      )}
      {confirmarElemento}
    </div>
  )
}

function FilaAsistencia({ fecha, marca, deshabilitado, porHora, onMarcar }: {
  fecha: string
  marca?: NomAsistencia
  deshabilitado: boolean
  porHora: boolean
  onMarcar: (fecha: string, estado: EstadoAsistencia | null, horas: number | null) => Promise<void>
}) {
  const [horas, setHoras] = useState(marca?.horas != null ? String(marca.horas) : '')
  useEffect(() => { setHoras(marca?.horas != null ? String(marca.horas) : '') }, [marca?.horas])
  const horasNum = horas.trim() === '' ? null : Number(horas.replace(',', '.'))

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <p className="text-xs font-semibold text-foreground">
        {diaCorto(fecha)} {fechaCorta(fecha)}
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Asistencia ${fecha}`}>
        {ESTADOS_ASISTENCIA.map(e => {
          const activo = marca?.estado === e.valor
          return (
            <button
              key={e.valor}
              type="button"
              disabled={deshabilitado}
              aria-pressed={activo}
              onClick={() => void onMarcar(fecha, activo ? null : e.valor, activo ? null : horasNum)}
              className={`h-9 px-3 rounded-full border text-xs font-semibold transition-colors disabled:opacity-50 ${
                activo ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border-control text-foreground hover:bg-muted'
              }`}
            >
              {e.etiqueta}
            </button>
          )
        })}
      </div>
      {porHora && marca && (marca.estado === 'trabajado' || marca.estado === 'medio') && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground" htmlFor={`h-${fecha}`}>Horas</label>
          <input
            id={`h-${fecha}`}
            inputMode="decimal"
            value={horas}
            disabled={deshabilitado}
            onChange={e => setHoras(e.target.value)}
            onBlur={() => {
              if (horasNum !== (marca.horas ?? null) && (horasNum === null || (!Number.isNaN(horasNum) && horasNum >= 0))) {
                void onMarcar(fecha, marca.estado, horasNum)
              }
            }}
            className="h-9 w-24 px-3 rounded-xl border border-border-control bg-input-background text-sm"
          />
        </div>
      )}
    </div>
  )
}
