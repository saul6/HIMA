import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Lock, ChevronLeft, ChevronRight, Users, BookOpen, History, Printer, CalendarRange } from 'lucide-react'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { FilaRegistro } from '@/app/components/ui-mady/FilaRegistro'
import { Etiqueta, type TonoEtiqueta } from '@/app/components/ui-mady/Etiqueta'
import { TarjetaContador } from '@/app/components/ui-mady/TarjetaContador'
import { Boton } from '@/app/components/ui-mady/Boton'
import { nomina, useNomPendientesSemana, useNomSemana } from '@/hooks/useNomina'
import { useConfirmar } from '@/app/components/ui-mady/ConfirmarSheet'
import { fechaHora } from '@/lib/formato'
import { MotivoSheet } from './ui'
import { toast } from 'sonner'
import { avisarErrorNomina } from '@/lib/nomina/errores'
import { generarVouchersSemanaPDF } from '@/lib/pdf/m81/generarVoucherPDF'
import { useConexion } from '@/hooks/useConexion'
import { hoyMX } from '@/lib/fecha'
import { formatoMoneda, lunesDe, rangoSemana, sumarDias } from '@/lib/nomina/formato'
import type { SemanaTrabajador } from '@/types/nomina.types'

export function estadoSemanaTrabajador(t: SemanaTrabajador): { texto: string; tono: TonoEtiqueta } {
  if (t.estado === 'aprobado') {
    switch (t.pago?.estado_pago) {
      case 'pagado': return { texto: 'Pagado', tono: 'menta' }
      case 'parcial': return { texto: 'Pago parcial', tono: 'sky' }
      case 'sin_importe': return { texto: 'Sin importe', tono: 'neutral' }
      default: return { texto: 'Aprobado', tono: 'sky' }
    }
  }
  if ((t.bloqueos ?? 0) > 0) return { texto: 'Con pendientes', tono: 'rojo' }
  return { texto: 'Borrador', tono: 'neutral' }
}

export function NominaSemana() {
  const navigate = useNavigate()
  const { offline } = useConexion()
  const hoy = hoyMX()
  const [params] = useSearchParams()
  const [lunes, setLunes] = useState(() => lunesDe(params.get('fecha') || hoy))
  const { datos: semana, cargando, error, recargar } = useNomSemana(lunes)
  const estadoSemana = useNomPendientesSemana(lunes)
  const { confirmar, confirmarElemento } = useConfirmar()
  const [reabriendo, setReabriendo] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const sem = estadoSemana.datos
  const cerrada = sem?.estado === 'cerrado'

  const moneda = semana?.moneda ?? 'MXN'
  const lunesArranque = semana?.fecha_arranque ? lunesDe(semana.fecha_arranque) : null
  const puedeAnterior = !lunesArranque || lunes > lunesArranque
  const esEstaSemana = lunes === lunesDe(hoy)

  const trabajadores = useMemo(() => semana?.trabajadores ?? [], [semana])
  const [imprimiendo, setImprimiendo] = useState(false)
  const cortesAprobados = trabajadores.flatMap(t => (t.estado === 'aprobado' && t.corte_id ? [t.corte_id] : []))

  async function cerrarSemana() {
    if (!(await confirmar({
      titulo: 'Cerrar semana',
      descripcion: 'Todos los cortes están aprobados. Una semana cerrada ya no permite capturar ni anular; puedes reabrirla con un motivo.',
      textoConfirmar: 'Cerrar semana',
    }))) return
    setCerrando(true)
    try {
      await nomina.cerrarSemana(lunes)
      toast.success('Semana cerrada')
      await Promise.all([estadoSemana.recargar(), recargar()])
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo cerrar la semana')
      await estadoSemana.recargar()
    } finally {
      setCerrando(false)
    }
  }

  async function imprimirVouchers() {
    setImprimiendo(true)
    try {
      await generarVouchersSemanaPDF(cortesAprobados, lunes)
    } catch (e) {
      avisarErrorNomina(e, 'No se pudieron generar los vouchers')
    } finally {
      setImprimiendo(false)
    }
  }

  return (
    <div className="min-h-full pb-safe-nav">
      <ModuloHeader
        tituloFallback="Actividades y pagos"
        acciones={
          <>
            <Boton variante="icono" aria-label="Trabajadores" onClick={() => navigate('/nomina/trabajadores')}>
              <Users className="size-5" />
            </Boton>
            <Boton variante="icono" aria-label="Catálogo" onClick={() => navigate('/nomina/catalogo')}>
              <BookOpen className="size-5" />
            </Boton>
            <Boton variante="icono" aria-label="Consolidado mensual" onClick={() => navigate('/nomina/mensual')}>
              <CalendarRange className="size-5" />
            </Boton>
            <Boton variante="icono" aria-label="Historial" onClick={() => navigate('/nomina/historial')}>
              <History className="size-5" />
            </Boton>
          </>
        }
      />

      <div className="px-4 py-4 space-y-4 max-w-3xl mx-auto">
        {offline && (
          <p className="rounded-xl bg-agro-info-fill text-agro-info-text text-xs px-3 py-2">
            Sin conexión: este módulo requiere internet para consultar y guardar.
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <Boton
            variante="icono"
            aria-label="Semana anterior"
            disabled={!puedeAnterior}
            onClick={() => setLunes(sumarDias(lunes, -7))}
          >
            <ChevronLeft className="size-5" />
          </Boton>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">{rangoSemana(lunes)}</p>
            {!esEstaSemana && (
              <button
                type="button"
                className="text-xs text-primary underline"
                onClick={() => setLunes(lunesDe(hoy))}
              >
                Esta semana
              </button>
            )}
          </div>
          <Boton
            variante="icono"
            aria-label="Semana siguiente"
            disabled={lunes >= lunesDe(hoy)}
            onClick={() => setLunes(sumarDias(lunes, 7))}
          >
            <ChevronRight className="size-5" />
          </Boton>
        </div>

        {sem && (
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">Estado de la semana</span>
              <Etiqueta tono={cerrada ? 'menta' : 'sky'}>{cerrada ? 'Cerrada' : 'Abierta'}</Etiqueta>
            </div>
            {cerrada && (
              <>
                <p className="text-sm text-agro-info-text bg-agro-info-fill rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <Lock className="size-4 shrink-0" /> Semana cerrada: no se captura ni se anula nada.
                </p>
                {sem.cerrado_en && <p className="text-xs text-muted-foreground">Cerrada el {fechaHora(sem.cerrado_en)}</p>}
                <Boton tamano="sm" variante="secundario" disabled={offline} onClick={() => setReabriendo(true)}>Reabrir</Boton>
              </>
            )}
            {!cerrada && sem.reabierto_en && (
              <p className="text-xs text-muted-foreground">
                Reabierta el {fechaHora(sem.reabierto_en)}{sem.motivo_reapertura ? ` · ${sem.motivo_reapertura}` : ''}
              </p>
            )}
            {!cerrada && sem.semana_terminada && sem.pendientes.length === 0 && (
              <Boton className="w-full" cargando={cerrando} disabled={offline || !sem.periodo_id} onClick={() => void cerrarSemana()}>
                Cerrar semana
              </Boton>
            )}
            {!cerrada && sem.semana_terminada && sem.pendientes.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Faltan cortes por aprobar para cerrar:</p>
                <ul className="space-y-1">
                  {sem.pendientes.map(p => (
                    <li key={p.trabajador_id} className="text-sm flex justify-between">
                      <span>{p.nombre} <span className="text-muted-foreground">· {p.codigo}</span></span>
                      <button type="button" className="text-xs underline font-semibold" onClick={() => navigate(`/nomina/semana/${p.trabajador_id}?fecha=${lunes}`)}>
                        Ver semana
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!cerrada && !sem.semana_terminada && (
              <p className="text-xs text-muted-foreground">Podrás cerrarla cuando termine la semana y todos los cortes estén aprobados.</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <TarjetaContador etiqueta="Aprobados" valor={semana?.totales.aprobados ?? null} />
          <TarjetaContador etiqueta="Borradores" valor={semana?.totales.borradores ?? null} />
          <TarjetaContador
            etiqueta="Neto aprobado"
            valor={semana ? semana.totales.neto_aprobado : null}
            format={n => formatoMoneda(n, moneda)}
          />
          <TarjetaContador
            etiqueta="Pendiente de pago"
            valor={semana ? semana.totales.pendiente_pago : null}
            format={n => formatoMoneda(n, moneda)}
            tono={semana && semana.totales.pendiente_pago > 0 ? 'info' : 'normal'}
          />
        </div>

        {error && (
          <div className="rounded-xl bg-agro-danger-fill text-agro-danger-text text-sm px-3 py-3 space-y-2">
            <p>{error}</p>
            <Boton tamano="sm" variante="secundario" onClick={() => void recargar()}>Reintentar</Boton>
          </div>
        )}

        {!error && !cargando && trabajadores.length === 0 && (
          <EstadoVacio
            icono={Users}
            titulo="Aún no hay trabajadores"
            ayuda="Da de alta a tu personal para capturar sus actividades y pagos."
            accion={<Boton onClick={() => navigate('/nomina/trabajadores')}>Ir a Trabajadores</Boton>}
          />
        )}

        {trabajadores.length > 0 && (
          <div>
            {trabajadores.map(t => {
              const est = estadoSemanaTrabajador(t)
              const aprobado = t.estado === 'aprobado'
              const pendiente = aprobado ? t.pago?.pendiente ?? 0 : t.pendiente_estimado ?? 0
              const exceso = aprobado ? t.pago?.exceso_anticipo ?? 0 : t.exceso_anticipo ?? 0
              return (
                <FilaRegistro
                  key={t.trabajador_id}
                  icono={null}
                  titulo={t.nombre}
                  subtitulo={t.codigo}
                  lineas={
                    <>
                      <span className="block">
                        {aprobado ? 'Neto' : 'Neto estimado'} {formatoMoneda(t.neto, moneda)}
                        {pendiente > 0 && <> · Pendiente {formatoMoneda(pendiente, moneda)}</>}
                      </span>
                      {exceso > 0 && (
                        <span className="block text-agro-danger-text font-semibold">
                          Anticipo mayor al neto: {formatoMoneda(exceso, moneda)}
                        </span>
                      )}
                    </>
                  }
                  derecha={<Etiqueta tono={est.tono}>{est.texto}</Etiqueta>}
                  chevron
                  to={`/nomina/semana/${t.trabajador_id}?fecha=${lunes}`}
                />
              )
            })}
          </div>
        )}
        {cortesAprobados.length > 0 && (
          <Boton variante="secundario" className="w-full" cargando={imprimiendo} disabled={offline} onClick={() => void imprimirVouchers()}>
            <Printer className="size-4" /> Imprimir vouchers de la semana
          </Boton>
        )}
      </div>
      {reabriendo && (
        <MotivoSheet
          titulo="Reabrir semana"
          descripcion="Podrás volver a capturar y anular. No se puede reabrir si el consolidado mensual de ese mes ya está finalizado."
          textoConfirmar="Reabrir semana"
          minimo={5}
          onClose={() => setReabriendo(false)}
          onConfirmar={async motivo => {
            await nomina.reabrirSemana(lunes, motivo)
            toast.success('Semana reabierta')
            await Promise.all([estadoSemana.recargar(), recargar()])
          }}
        />
      )}
      {confirmarElemento}
    </div>
  )
}
