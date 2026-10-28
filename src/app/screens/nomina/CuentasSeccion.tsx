import { useState } from 'react'
import { toast } from 'sonner'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { FilaRegistro } from '@/app/components/ui-mady/FilaRegistro'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { useConexion } from '@/hooks/useConexion'
import { nomina, useNomCuentas } from '@/hooks/useNomina'
import { avisarErrorNomina } from '@/lib/nomina/errores'
import { etiquetaMetodo, etiquetaOrigenPrestamo, fechaCorta, formatoMoneda } from '@/lib/nomina/formato'
import { AbonarSheet, AhorroSheet, DevolverAhorroSheet, LiberarComisionSheet, PrestarSheet } from './SheetsCuentas'
import { MotivoSheet } from './ui'
import type { CuentaPrestamoMov } from '@/types/nomina.types'

type Sheet =
  | { tipo: 'prestar' }
  | { tipo: 'abonar'; id: string; saldo: number }
  | { tipo: 'cancelar-prestamo'; id: string }
  | { tipo: 'ahorro' }
  | { tipo: 'devolver' }
  | { tipo: 'liberar' }
  | null

const TIPO_MOV: Record<string, string> = {
  apertura: 'Excedente de anticipo', desembolso: 'Préstamo entregado', recuperacion: 'Descuento en corte',
  abono: 'Abono', reversion: 'Reversión', cancelacion: 'Cancelación',
  aportacion: 'Aportación', descuento: 'Aportación', devolucion: 'Devolución', ajuste: 'Ajuste',
  acumulacion: 'Acumulada', liberacion: 'Liberada',
}
const etiquetaTipo = (t: string) => TIPO_MOV[t] ?? t.replace(/_/g, ' ')

function Movimientos({ items, moneda }: {
  items: (Pick<CuentaPrestamoMov, 'tipo' | 'monto' | 'fecha'> & Partial<CuentaPrestamoMov>)[]
  moneda: string
}) {
  if (items.length === 0) return null
  return (
    <ul className="pl-3 text-xs text-muted-foreground space-y-0.5 mt-1">
      {items.map((m, i) => (
        <li key={i}>
          {etiquetaTipo(m.tipo)} · {formatoMoneda(Math.abs(Number(m.monto)), moneda)}
          {m.fecha ? ` · ${fechaCorta(m.fecha)}` : ''}
          {m.metodo ? ` · ${etiquetaMetodo(m.metodo)}` : ''}
          {m.folio_corte ? ` · corte ${m.folio_corte}` : ''}
          {m.referencia ? ` · ${m.referencia}` : ''}
          {m.motivo ? ` · ${m.motivo}` : ''}
        </li>
      ))}
    </ul>
  )
}

export function CuentasSeccion({ trabajadorId, moneda }: { trabajadorId: string; moneda: string }) {
  const { offline } = useConexion()
  const { datos, cargando, error, recargar } = useNomCuentas(trabajadorId)
  const [sheet, setSheet] = useState<Sheet>(null)
  const cerrar = () => setSheet(null)

  if (cargando && !datos) return <p className="text-sm text-muted-foreground py-4 text-center">Cargando cuentas…</p>
  if (error && !datos) {
    return (
      <div className="rounded-xl bg-agro-danger-fill text-agro-danger-text text-sm px-3 py-3 space-y-2">
        <p>{error}</p>
        <Boton tamano="sm" variante="secundario" onClick={() => void recargar()}>Reintentar</Boton>
      </div>
    )
  }
  if (!datos) return null

  const { prestamos, ahorro, comisiones } = datos
  const activos = prestamos.filter(p => p.estado === 'activo')
  const cerrados = prestamos.filter(p => p.estado !== 'activo')

  const fila = (p: (typeof prestamos)[number]) => {
    const manual = p.origen === 'manual'
    return (
      <div key={p.id} className="border-b border-border py-2">
        <FilaRegistro
          icono={null}
          titulo={etiquetaOrigenPrestamo(p.origen)}
          subtitulo={`${fechaCorta(p.creado_en.slice(0, 10))} ${p.creado_en.slice(0, 4)} · original ${formatoMoneda(p.monto_original, moneda)}${p.nota ? ` · ${p.nota}` : ''}`}
          derecha={
            <span className="flex flex-col items-end gap-1">
              <span className={`text-sm font-semibold tabular-nums ${p.saldo > 0 ? 'text-agro-danger-text' : ''}`}>
                {formatoMoneda(p.saldo, moneda)}
              </span>
              {p.estado !== 'activo' && <Etiqueta tono="neutral">{p.estado === 'cancelado' ? 'Cancelado' : 'Liquidado'}</Etiqueta>}
            </span>
          }
          acciones={p.estado === 'activo' && (
            <>
              <Boton tamano="sm" variante="secundario" disabled={offline || p.saldo <= 0} onClick={() => setSheet({ tipo: 'abonar', id: p.id, saldo: p.saldo })}>
                Abonar
              </Boton>
              {manual && p.movimientos.length <= 1 && p.descuentos_programados.length === 0 && (
                <Boton tamano="sm" variante="secundario" disabled={offline} onClick={() => setSheet({ tipo: 'cancelar-prestamo', id: p.id })}>
                  Cancelar
                </Boton>
              )}
            </>
          )}
        />
        {p.descuentos_programados.length > 0 && (
          <p className="pl-3 text-xs text-muted-foreground">
            Descuentos programados: {p.descuentos_programados.map(d => `${fechaCorta(d.semana_inicio)} ${formatoMoneda(d.monto, moneda)}`).join(', ')}
          </p>
        )}
        <Movimientos items={p.movimientos} moneda={moneda} />
      </div>
    )
  }

  return (
    <>
      <section>
        <div className="flex items-center justify-between mb-2">
          <TituloSeccion className="mb-0">Préstamos</TituloSeccion>
          <Boton tamano="sm" variante="secundario" disabled={offline} onClick={() => setSheet({ tipo: 'prestar' })}>Prestar</Boton>
        </div>
        {prestamos.length === 0 && <p className="text-sm text-muted-foreground py-2">Sin préstamos.</p>}
        {activos.map(fila)}
        {cerrados.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs font-semibold text-muted-foreground cursor-pointer">Cerrados ({cerrados.length})</summary>
            {cerrados.map(fila)}
          </details>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <TituloSeccion className="mb-0">Ahorro</TituloSeccion>
          <span className="flex gap-2">
            <Boton tamano="sm" variante="secundario" disabled={offline} onClick={() => setSheet({ tipo: 'ahorro' })}>Cambiar</Boton>
            <Boton tamano="sm" variante="secundario" disabled={offline || ahorro.saldo <= 0} onClick={() => setSheet({ tipo: 'devolver' })}>Devolver</Boton>
          </span>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Monto semanal</span>
            <span className="tabular-nums">
              {ahorro.vigente ? `${formatoMoneda(ahorro.vigente.monto_semanal, moneda)} desde ${fechaCorta(ahorro.vigente.desde)}` : 'Sin ahorro'}
            </span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Ahorro acumulado</span>
            <span className="tabular-nums">{formatoMoneda(ahorro.saldo, moneda)}</span>
          </div>
        </div>
        <Movimientos items={ahorro.movimientos} moneda={moneda} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <TituloSeccion className="mb-0">Comisiones</TituloSeccion>
          <Boton tamano="sm" variante="secundario" disabled={offline || comisiones.saldo_por_liberar <= 0} onClick={() => setSheet({ tipo: 'liberar' })}>
            Liberar
          </Boton>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-sm flex justify-between font-semibold">
          <span>Por liberar</span>
          <span className="tabular-nums">{formatoMoneda(comisiones.saldo_por_liberar, moneda)}</span>
        </div>
        {comisiones.liberaciones_pendientes.map(l => (
          <FilaRegistro
            key={l.id}
            icono={null}
            titulo={`Liberación semana del ${fechaCorta(l.semana_inicio)}`}
            subtitulo={l.motivo ?? undefined}
            derecha={<span className="text-sm font-semibold tabular-nums">{formatoMoneda(l.monto, moneda)}</span>}
            acciones={
              <Boton
                tamano="sm" variante="secundario" disabled={offline}
                onClick={async () => {
                  try {
                    await nomina.cancelarLiberacion(l.id)
                    toast.success('Liberación cancelada')
                    await recargar()
                  } catch (e) {
                    avisarErrorNomina(e, 'No se pudo cancelar la liberación')
                  }
                }}
              >
                Cancelar
              </Boton>
            }
          />
        ))}
        <Movimientos items={comisiones.movimientos} moneda={moneda} />
      </section>

      {sheet?.tipo === 'prestar' && <PrestarSheet trabajadorId={trabajadorId} moneda={moneda} onClose={cerrar} onGuardado={recargar} />}
      {sheet?.tipo === 'abonar' && <AbonarSheet prestamoId={sheet.id} saldo={sheet.saldo} moneda={moneda} onClose={cerrar} onGuardado={recargar} />}
      {sheet?.tipo === 'cancelar-prestamo' && (
        <MotivoSheet
          titulo="Cancelar préstamo"
          descripcion="Solo se pueden cancelar préstamos manuales sin descuentos ni abonos."
          textoConfirmar="Cancelar préstamo"
          onClose={cerrar}
          onConfirmar={async motivo => {
            await nomina.cancelarPrestamo(sheet.id, motivo)
            toast.success('Préstamo cancelado')
            await recargar()
          }}
        />
      )}
      {sheet?.tipo === 'ahorro' && (
        <AhorroSheet trabajadorId={trabajadorId} moneda={moneda} vigente={ahorro.vigente?.monto_semanal ?? null} onClose={cerrar} onGuardado={recargar} />
      )}
      {sheet?.tipo === 'devolver' && (
        <DevolverAhorroSheet trabajadorId={trabajadorId} moneda={moneda} saldo={ahorro.saldo} onClose={cerrar} onGuardado={recargar} />
      )}
      {sheet?.tipo === 'liberar' && (
        <LiberarComisionSheet trabajadorId={trabajadorId} moneda={moneda} disponible={comisiones.saldo_por_liberar} onClose={cerrar} onGuardado={recargar} />
      )}
    </>
  )
}
