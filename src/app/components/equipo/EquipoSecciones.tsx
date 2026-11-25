import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Users, History } from 'lucide-react'
import { Switch } from '@/app/components/ui/switch'
import { Skeleton } from '@/app/components/ui/skeleton'
import { Boton } from '@/app/components/ui-mady/Boton'
import { ConfirmarSheet } from '@/app/components/ui-mady/ConfirmarSheet'
import { BottomSheet } from '@/app/components/BottomSheet'
import { mensajeErrorBd } from '@/lib/erroresBd'
import {
  equipoAsignar,
  equipoConfigurar,
  equipoConsultarConfig,
  equipoHistorial,
  equipoQuitar,
  useEquipo,
  type ConfigEquipo,
  type HistorialEquipoItem,
} from '@/hooks/useEquipo'

const CLASE_SELECT =
  'h-10 w-full min-w-0 rounded-lg border border-border-control bg-input-background px-3 text-sm focus:border-primary focus:outline-none'

const MOTIVOS_BAJA: Record<string, string> = {
  QUITADO: 'Quitado',
  REASIGNADO: 'Reasignado',
  CAMBIO_ROL: 'Cambió de rol',
  BAJA: 'Dado de baja',
  CAMBIO_ORG: 'Cambió de organización',
  PERFIL_BORRADO: 'Perfil eliminado',
}

function fechaHora(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground font-semibold">{titulo}</p>
      </div>
      {children}
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs flex-shrink-0 px-2 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground">
      {children}
    </span>
  )
}

// ── Admin: interruptor + asignación ───────────────────────────────────────────

/** Interruptor por organización «Limitar encargados a su equipo». Solo admin_org / super_admin. */
export function InterruptorEquipo({ alCambiar }: { alCambiar?: () => void }) {
  const [config, setConfig] = useState<ConfigEquipo | null>(null)
  const [cambiando, setCambiando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => {
    equipoConsultarConfig()
      .then(setConfig)
      .catch((e) => toast.error(mensajeErrorBd(e, 'No se pudo cargar la configuración del equipo')))
  }, [])

  async function aplicar(valor: boolean) {
    setCambiando(true)
    try {
      const nueva = await equipoConfigurar(valor)
      setConfig(nueva)
      toast.success(
        nueva.restringir_encargados
          ? 'Los encargados ahora ven solo a su equipo'
          : 'Los encargados vuelven a ver a toda la organización',
      )
      alCambiar?.()
    } catch (e) {
      toast.error(mensajeErrorBd(e, 'No se pudo cambiar la configuración'))
    } finally {
      setCambiando(false)
      setConfirmando(false)
    }
  }

  if (!config) return null
  const sinEquipo = config.encargados_sin_equipo ?? []

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground font-semibold">Limitar encargados a su equipo</p>
          <p className="text-xs text-muted-foreground mt-1">
            {config.restringir_encargados
              ? 'Activado: cada encargado ve en Actividad y Métricas solo lo suyo y lo de sus operarios.'
              : 'Desactivado: los encargados ven la actividad de toda la organización.'}
          </p>
          {config.cambiado_en && (
            <p className="text-xs text-muted-foreground mt-1">
              Último cambio: {config.cambiado_por_nombre ?? 'Sistema'} · {fechaHora(config.cambiado_en)}
            </p>
          )}
        </div>
        <Switch
          checked={config.restringir_encargados}
          onCheckedChange={(v) => (v ? setConfirmando(true) : aplicar(false))}
          disabled={cambiando}
          aria-label="Limitar encargados a su equipo"
          className="flex-shrink-0"
        />
      </div>

      <ConfirmarSheet
        abierto={confirmando}
        titulo="Limitar encargados a su equipo"
        descripcion="Cada encargado verá en Actividad y Métricas solo sus registros y los de sus operarios. Verificar sigue igual para todos los encargados."
        textoConfirmar={cambiando ? 'Activando…' : 'Activar'}
        onConfirmar={() => aplicar(true)}
        onCancelar={() => setConfirmando(false)}
      >
        {sinEquipo.length > 0 && (
          <div
            className="rounded-xl px-4 py-3 text-xs space-y-1"
            style={{ background: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}
          >
            <p className="font-semibold">Estos encargados no tienen operarios y verían solo lo propio:</p>
            <p>{sinEquipo.map((e) => e.nombre).join(', ')}</p>
          </div>
        )}
      </ConfirmarSheet>
    </>
  )
}

function HistorialSheet({ abierto, onClose }: { abierto: boolean; onClose: () => void }) {
  const [filas, setFilas] = useState<HistorialEquipoItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!abierto) return
    setFilas(null)
    setError(null)
    equipoHistorial()
      .then((d) => setFilas(d ?? []))
      .catch((e) => setError(mensajeErrorBd(e, 'No se pudo cargar el historial')))
  }, [abierto])

  return (
    <BottomSheet open={abierto} onClose={onClose} title="Historial de equipos">
      <div className="px-4 py-4 space-y-2">
        {error && <p className="text-sm text-muted-foreground">{error}</p>}
        {!error && filas === null && <Skeleton className="h-16 w-full rounded-xl" />}
        {filas?.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay movimientos.</p>}
        {filas?.map((h) => (
          <div key={h.asignacion_id} className="rounded-lg bg-muted px-3 py-2 text-xs space-y-0.5">
            <p className="text-sm text-foreground font-semibold">
              {h.operario} → {h.encargado}
            </p>
            <p className="text-muted-foreground">
              Asignado {fechaHora(h.asignado_en)}
              {h.asignado_por_nombre ? ` por ${h.asignado_por_nombre}` : ''}
            </p>
            {h.vigente ? (
              <p className="text-muted-foreground">Vigente</p>
            ) : (
              <p className="text-muted-foreground">
                {MOTIVOS_BAJA[h.motivo_baja ?? ''] ?? 'Cerrado'} {fechaHora(h.quitado_en)}
                {h.quitado_por_nombre ? ` por ${h.quitado_por_nombre}` : ''}
              </p>
            )}
          </div>
        ))}
      </div>
    </BottomSheet>
  )
}

/** Admin: encargados con sus operarios, operarios sin encargado, asignar / reasignar / quitar. */
export function EquipoAdmin() {
  const { equipo, loading, error, refetch } = useEquipo(true)
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const [historial, setHistorial] = useState(false)

  async function cambiar(operarioId: string, encargadoId: string) {
    setTrabajando(operarioId)
    try {
      if (encargadoId === '') {
        await equipoQuitar(operarioId)
        toast.success('Operario sin encargado')
      } else {
        await equipoAsignar(operarioId, encargadoId)
        toast.success('Encargado asignado')
      }
    } catch (e) {
      toast.error(mensajeErrorBd(e, 'No se pudo actualizar el equipo'))
    } finally {
      setTrabajando(null)
      refetch()
    }
  }

  const encargados = equipo?.encargados ?? []
  const sinEncargado = equipo?.sin_encargado ?? []

  // Función (no componente): así el <select> no se vuelve a montar en cada render.
  const selector = (operarioId: string, actual: string) => {
    return (
      <select
        aria-label="Encargado"
        value={actual}
        disabled={trabajando === operarioId}
        onChange={(e) => cambiar(operarioId, e.target.value)}
        className={`${CLASE_SELECT} max-w-[11rem]`}
      >
        {actual === '' && <option value="">Sin encargado</option>}
        {actual !== '' && <option value="">Quitar encargado</option>}
        {encargados.map((e) => (
          <option key={e.encargado_id} value={e.encargado_id}>
            {e.nombre}
          </option>
        ))}
      </select>
    )
  }

  return (
    <Tarjeta titulo="ENCARGADOS Y SU EQUIPO">
      {loading && !equipo ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : error ? (
        <p className="text-sm text-muted-foreground">No se pudo cargar el equipo.</p>
      ) : encargados.length === 0 && sinEncargado.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay encargados ni operarios.</p>
      ) : (
        <div className="space-y-4">
          {encargados.map((enc) => (
            <div key={enc.encargado_id} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-foreground font-semibold truncate">{enc.nombre}</p>
                <Chip>
                  {enc.operarios.length} {enc.operarios.length === 1 ? 'operario' : 'operarios'}
                </Chip>
              </div>
              {enc.operarios.length === 0 && (
                <p className="text-xs text-muted-foreground">Sin operarios.</p>
              )}
              {enc.operarios.map((op) => (
                <div
                  key={op.operario_id}
                  className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-muted"
                >
                  <span className="text-sm text-foreground truncate">{op.nombre}</span>
                  {selector(op.operario_id, enc.encargado_id)}
                </div>
              ))}
            </div>
          ))}

          {sinEncargado.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-semibold">SIN ENCARGADO</p>
              {sinEncargado.map((op) => (
                <div
                  key={op.operario_id}
                  className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-muted"
                >
                  <span className="text-sm text-foreground truncate">{op.nombre}</span>
                  {selector(op.operario_id, '')}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setHistorial(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-primary"
      >
        <History className="w-3.5 h-3.5" /> Ver historial
      </button>
      <HistorialSheet abierto={historial} onClose={() => setHistorial(false)} />
    </Tarjeta>
  )
}

// ── Encargado: «Mi equipo» ────────────────────────────────────────────────────

export function MiEquipo({ miId }: { miId: string }) {
  const { equipo, loading, error, refetch } = useEquipo(true)
  const [agregando, setAgregando] = useState(false)
  const [trabajando, setTrabajando] = useState<string | null>(null)

  const mios = equipo?.encargados.find((e) => e.encargado_id === miId)?.operarios ?? []
  const disponibles = equipo?.sin_encargado ?? []

  async function ejecutar(operarioId: string, accion: 'agregar' | 'quitar') {
    setTrabajando(operarioId)
    try {
      if (accion === 'agregar') await equipoAsignar(operarioId)
      else await equipoQuitar(operarioId)
      toast.success(accion === 'agregar' ? 'Operario agregado a tu equipo' : 'Operario quitado de tu equipo')
    } catch (e) {
      toast.error(mensajeErrorBd(e, 'No se pudo actualizar tu equipo'))
    } finally {
      setTrabajando(null)
      refetch()
    }
  }

  return (
    <Tarjeta titulo="MI EQUIPO">
      {equipo && !equipo.restringir_encargados && (
        <p
          className="rounded-xl px-4 py-3 text-xs"
          style={{ background: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' }}
        >
          Tu organización aún no limita la vista por equipo; verás a todos en Actividad y Métricas.
        </p>
      )}
      {loading && !equipo ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : error ? (
        <p className="text-sm text-muted-foreground">No se pudo cargar tu equipo.</p>
      ) : mios.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no tienes operarios en tu equipo.</p>
      ) : (
        <div className="space-y-2">
          {mios.map((op) => (
            <div key={op.operario_id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-muted">
              <span className="text-sm text-foreground truncate">{op.nombre}</span>
              <button
                type="button"
                disabled={trabajando === op.operario_id}
                onClick={() => ejecutar(op.operario_id, 'quitar')}
                className="text-xs font-semibold px-3 py-2 -my-2 rounded-lg text-agro-red hover:bg-border transition-colors flex-shrink-0 disabled:opacity-50"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}
      <Boton variante="secundario" tamano="sm" onClick={() => setAgregando(true)}>
        Agregar operario
      </Boton>

      <BottomSheet open={agregando} onClose={() => setAgregando(false)} title="Agregar operario">
        <div className="px-4 py-4 space-y-2">
          {disponibles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay operarios sin encargado.</p>
          ) : (
            disponibles.map((op) => (
              <div key={op.operario_id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-muted">
                <span className="text-sm text-foreground truncate">{op.nombre}</span>
                <Boton
                  tamano="sm"
                  cargando={trabajando === op.operario_id}
                  onClick={() => ejecutar(op.operario_id, 'agregar')}
                >
                  Agregar
                </Boton>
              </div>
            ))
          )}
        </div>
      </BottomSheet>
    </Tarjeta>
  )
}
