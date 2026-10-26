import { useState, useEffect, useRef } from 'react'
import { useNavigate, Navigate, Outlet } from 'react-router'
import { motion, LayoutGroup, useReducedMotion } from 'motion/react'
import {
  Building2, ChevronRight,
  AlertCircle, Calendar, CheckCircle2, RefreshCw, PlayCircle, Layers,
} from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { useAuditorAsignaciones } from '@/hooks/useAuditorAsignaciones'
import { useAuditorJornada } from '@/hooks/useAuditorJornada'
import { supabase } from '@/lib/supabase'
import { hoyMX } from '@/lib/fecha'
import { useLastWorkspace } from '@/hooks/useContinuarTrabajo'
import { ahora, ms, emitirEvento, markResume } from '@/lib/telemetria'
import { AuditorNuevaAuditoriaSheet } from './AuditorNuevaAuditoriaSheet'
import { AuditorCampana } from './AuditorCampana'
import { AuditorBusqueda } from './AuditorBusqueda'
import { Fab } from '@/app/components/Fab'
import { EncabezadoPantalla } from '@/app/components/EncabezadoPantalla'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Skeleton } from '@/app/components/ui/skeleton'
import { TarjetaContador } from '@/app/components/ui-mady/TarjetaContador'
import { Etiqueta, type TonoEtiqueta } from '@/app/components/ui-mady/Etiqueta'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { DUR, EASE_OUT } from '@/lib/motion'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string) => (supabase as any).rpc(fn)

interface WorkQueueItem {
  entity_type: string
  entity_id: string
  capa_id: string | null
  organization_id: string | null
  rancho_id: string | null
  instalacion_id: string | null
  auditoria_id: string | null
  title: string
  next_action_code: string
  priority: number
  due_at: string | null
  last_activity_at: string
  route: string
}

interface VisitaHoy {
  agenda_id: string
  titulo: string
  auditoria_id: string
}

interface DashboardResumen {
  por_accion: Record<string, number>
  vencidas: number
  listas_azzule: number
  seguimiento_azzule: number
  por_validar: number
  total_pendiente: number
  visitas_hoy: VisitaHoy[]
}

const ACCION_LABELS: Record<string, string> = {
  CREAR_ACCION_CORRECTIVA: 'Crear acción correctiva',
  COMPLETAR_AC: 'Completar acción',
  VALIDAR_PARA_AZZULE: 'Validar para Azzule',
  ABRIR_MODO_AZZULE: 'Transferir en Modo Azzule',
  VERIFICAR_ESTADO_AZZULE: 'Verificar estado en Azzule',
  CORREGIR_AC: 'Corregir (Azzule devolvió)',
  CERRAR_HALLAZGO: 'Cerrar hallazgo',
  SIN_ACCION: 'Sin acción',
}

const FILTRO_LABELS: Record<string, string> = {
  __vencidas__: 'Vencidas',
  VALIDAR_PARA_AZZULE: 'Por validar',
  ABRIR_MODO_AZZULE: 'Listas para Azzule',
  VERIFICAR_ESTADO_AZZULE: 'Seguimiento Azzule',
  CORREGIR_AC: 'Corregir (Azzule devolvió)',
  CREAR_ACCION_CORRECTIVA: 'Crear acción correctiva',
  COMPLETAR_AC: 'Completar acción',
  CERRAR_HALLAZGO: 'Cerrar hallazgo',
}

function accionTono(code: string): TonoEtiqueta {
  switch (code) {
    case 'CORREGIR_AC':
      return 'error'
    case 'CREAR_ACCION_CORRECTIVA':
    case 'COMPLETAR_AC':
      return 'sky'
    case 'VALIDAR_PARA_AZZULE':
    case 'ABRIR_MODO_AZZULE':
      return 'menta'
    default:
      return 'neutral'
  }
}

function esVencida(item: WorkQueueItem, hoy: string): boolean {
  return item.priority === 1 || (!!item.due_at && item.due_at < hoy)
}

// Entrada escalonada compartida (solo los primeros 8; el resto aparece sin retraso).
function entrada(index: number, reducedMotion: boolean | null) {
  return {
    initial: reducedMotion ? (false as const) : { opacity: 0, y: 8 },
    animate: {
      opacity: 1, y: 0,
      transition: { duration: DUR.base, ease: EASE_OUT, delay: Math.min(index, 7) * 0.03 },
    },
  }
}

function WorkQueueCard({
  item,
  orgNombre,
  hoy,
  index,
  reducedMotion,
  onClick,
}: {
  item: WorkQueueItem
  orgNombre: string | null
  hoy: string
  index: number
  reducedMotion: boolean | null
  onClick: () => void
}) {
  const vencida = esVencida(item, hoy)
  return (
    <motion.div {...entrada(index, reducedMotion)}>
      <button
        onClick={onClick}
        className="group w-full text-left bg-card rounded-xl border p-4 flex flex-col gap-2 hover:bg-muted active:opacity-70 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        style={{
          borderColor: vencida ? 'var(--agro-danger-text)' : 'var(--border)',
          borderWidth: vencida ? '1.5px' : undefined,
          transitionDuration: 'var(--motion-fast)',
        }}
      >
        <div className="flex items-start gap-2">
          <p className="flex-1 text-sm font-medium leading-snug line-clamp-2" style={{ color: 'var(--foreground)' }}>
            {item.title}
          </p>
          <ChevronRight
            size={15}
            className="flex-shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
            style={{ color: 'var(--muted-foreground)', transitionDuration: 'var(--motion-fast)' }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {vencida && (
            <Etiqueta tono="error" icono={<AlertCircle size={10} />}>Vencida</Etiqueta>
          )}
          {item.next_action_code !== 'SIN_ACCION' && (
            <Etiqueta tono={accionTono(item.next_action_code)}>
              {ACCION_LABELS[item.next_action_code] ?? item.next_action_code}
            </Etiqueta>
          )}
          {orgNombre && (
            <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
              {orgNombre}
            </span>
          )}
        </div>
      </button>
    </motion.div>
  )
}

export function AuditorHome() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()
  const { orgs, loading: loadingOrgs } = useAuditorAsignaciones()
  const { workspace } = useLastWorkspace()
  const { jornadas: todasJornadas, cargarJornadas } = useAuditorJornada()
  const reducedMotion = useReducedMotion()

  const [cola, setCola] = useState<WorkQueueItem[]>([])
  const [resumen, setResumen] = useState<DashboardResumen | null>(null)
  const [loadingDash, setLoadingDash] = useState(true)
  const [errorDash, setErrorDash] = useState(false)
  const [filtro, setFiltro] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showSheet, setShowSheet] = useState(false)
  const jornadasAbiertas = todasJornadas.filter(j => j.estado === 'abierta')

  const clicksBeforeResumeRef = useRef(0)

  const hoy = hoyMX()

  if (profile !== null && profile.rol !== 'auditor' && profile.rol !== 'super_admin') {
    return <Navigate to="/" replace />
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false

    async function cargar() {
      setLoadingDash(true)
      setErrorDash(false)
      const t0 = ahora()
      try {
        const [colaRes, resRes] = await Promise.all([
          tbl('aud_work_queue')
            .select('*')
            .order('priority', { ascending: true })
            .order('last_activity_at', { ascending: false })
            .limit(100),
          rpc('aud_auditor_dashboard'),
        ])
        if (cancelled) return
        if (colaRes.error) throw colaRes.error
        if (resRes.error) throw resRes.error
        setCola(colaRes.data ?? [])
        setResumen((resRes.data as DashboardResumen) ?? null)
        emitirEvento('lat_dashboard', ms(t0))
        cargarJornadas().catch(e => console.error('[AuditorHome] jornadas', e))
      } catch (e) {
        if (!cancelled) {
          console.error('[AuditorHome] dashboard', e)
          setErrorDash(true)
        }
      } finally {
        if (!cancelled) setLoadingDash(false)
      }
    }

    cargar()
    return () => { cancelled = true }
  }, [profile?.id, refreshKey])

  const orgNombreMap = new Map(orgs.map(o => [o.org_id, o.nombre]))

  const colaFiltrada = (() => {
    if (!filtro) return cola
    if (filtro === '__vencidas__') return cola.filter(i => esVencida(i, hoy))
    return cola.filter(i => i.next_action_code === filtro)
  })()

  const itemsVencidos = colaFiltrada.filter(i => esVencida(i, hoy))
  const itemsResto = colaFiltrada.filter(i => !esVencida(i, hoy))

  return (
    <div className="flex flex-col min-h-screen pb-24" style={{ backgroundColor: 'var(--background)' }}>

      {/* Celular: saludo, calendario y campana; en escritorio no hay segundo header (lo da el Layout) */}
      <EncabezadoPantalla
        titulo={`Hola, ${profile?.nombre_completo?.split(' ')[0] ?? '—'}`}
        subtitulo="Auditores · M.A.D.Y"
        alRegresar={() => navigate('/auditor')}
        accionesMovil={(
          <>
            <Boton variante="icono" onClick={() => navigate('/auditor/agenda?tab=calendario')} aria-label="Calendario">
              <Calendar size={16} style={{ color: 'var(--muted-foreground)' }} />
            </Boton>
            <AuditorCampana />
          </>
        )}
      />

      <main className="flex-1 px-4 py-4 flex flex-col gap-5">

        {/* Buscador — móvil (en escritorio vive en el header del Layout) */}
        <div className="md:hidden">
          <AuditorBusqueda />
        </div>

        {/* ── Continuar trabajo ──────────────────────────────────────── */}
        {workspace && (
          <section>
            <button
              onClick={() => { markResume(clicksBeforeResumeRef.current); navigate(workspace.route) }}
              className="w-full text-left bg-card rounded-xl p-4 flex items-center gap-3 hover:bg-muted active:opacity-70 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              style={{ border: '1.5px solid var(--primary)', transitionDuration: 'var(--motion-fast)' }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--agro-success-fill)' }}
              >
                <PlayCircle size={18} style={{ color: 'var(--agro-success-text)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-caption font-semibold" style={{ color: 'var(--primary)' }}>
                  Continuar trabajo
                </p>
                <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                  {workspace.titulo}
                </p>
              </div>
              <ChevronRight size={15} style={{ color: 'var(--muted-foreground)' }} />
            </button>
          </section>
        )}

        {/* ── Franja de resumen ──────────────────────────────────────── */}
        {loadingDash ? (
          <section>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="rounded-xl p-3 md:p-4 border border-border bg-card space-y-2">
                  <Skeleton className="h-7 w-10" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </section>
        ) : resumen && (
          <section>
            <LayoutGroup id="auditor-resumen">
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                <TarjetaContador
                  indice={0} variante="seleccionable" valorPrimero resaltadoId="auditor-resumen-activa" tono="alertaTexto"
                  className="p-3 md:p-4"
                  activo={filtro === '__vencidas__'} etiqueta="Vencidas" valor={resumen.vencidas}
                  onClick={() => setFiltro(f => f === '__vencidas__' ? null : '__vencidas__')}
                />
                <TarjetaContador
                  indice={1} variante="seleccionable" valorPrimero resaltadoId="auditor-resumen-activa"
                  className="p-3 md:p-4"
                  activo={filtro === 'VALIDAR_PARA_AZZULE'} etiqueta="Por validar" valor={resumen.por_validar}
                  onClick={() => setFiltro(f => f === 'VALIDAR_PARA_AZZULE' ? null : 'VALIDAR_PARA_AZZULE')}
                />
                <TarjetaContador
                  indice={2} variante="seleccionable" valorPrimero resaltadoId="auditor-resumen-activa"
                  className="p-3 md:p-4"
                  activo={filtro === 'ABRIR_MODO_AZZULE'} etiqueta="Listas Azzule" valor={resumen.listas_azzule}
                  onClick={() => setFiltro(f => f === 'ABRIR_MODO_AZZULE' ? null : 'ABRIR_MODO_AZZULE')}
                />
                <TarjetaContador
                  indice={3} variante="seleccionable" valorPrimero resaltadoId="auditor-resumen-activa"
                  className="p-3 md:p-4"
                  activo={filtro === 'VERIFICAR_ESTADO_AZZULE'} etiqueta="Seguimiento" valor={resumen.seguimiento_azzule}
                  onClick={() => setFiltro(f => f === 'VERIFICAR_ESTADO_AZZULE' ? null : 'VERIFICAR_ESTADO_AZZULE')}
                />
                <TarjetaContador
                  indice={4} variante="seleccionable" valorPrimero resaltadoId="auditor-resumen-activa"
                  className="p-3 md:p-4"
                  activo={!filtro} etiqueta="Total" valor={resumen.total_pendiente}
                  onClick={() => setFiltro(null)}
                />
              </div>
            </LayoutGroup>
          </section>
        )}

        {/* ── Visitas de hoy ─────────────────────────────────────────── */}
        {resumen && resumen.visitas_hoy.length > 0 && (
          <section>
            <TituloSeccion as="p">Visitas de hoy</TituloSeccion>
            <div className="flex flex-col gap-2">
              {resumen.visitas_hoy.map(v => (
                <button
                  key={v.agenda_id}
                  onClick={() => navigate(`/auditor/auditoria/${v.auditoria_id}`)}
                  className="w-full text-left bg-card rounded-xl border border-border p-3 flex items-center gap-3 hover:bg-muted active:opacity-70 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--agro-success-fill)' }}
                  >
                    <Calendar size={15} style={{ color: 'var(--agro-success-text)' }} />
                  </div>
                  <p
                    className="flex-1 text-sm font-medium truncate"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {v.titulo}
                  </p>
                  <ChevronRight size={15} style={{ color: 'var(--muted-foreground)' }} />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Jornadas abiertas + Auditar por bloque ─────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <TituloSeccion as="p" className="mb-0">Captura por bloque</TituloSeccion>
            <button
              onClick={() => navigate('/auditor/jornada/nueva')}
              className="flex items-center gap-1 text-small font-semibold px-2.5 py-1 rounded-lg transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              style={{ border: '1px solid var(--ring)', color: 'var(--foreground)', transitionDuration: 'var(--motion-fast)' }}
            >
              <Layers size={11} />
              Auditar por bloque
            </button>
          </div>
          {jornadasAbiertas.length > 0 ? (
            <div className="flex flex-col gap-2">
              {jornadasAbiertas.map(j => (
                <button
                  key={j.jornada_id}
                  onClick={() => navigate(`/auditor/jornada/${j.jornada_id}`)}
                  className="w-full text-left bg-card rounded-xl border border-border p-3 flex items-center gap-3 hover:bg-muted active:opacity-70 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--agro-success-fill)' }}
                  >
                    <Layers size={15} style={{ color: 'var(--agro-success-text)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                      {j.nombre}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {j.operaciones.length} {j.operaciones.length === 1 ? 'operación' : 'operaciones'}
                      {' · '}{j.fecha.split('-').reverse().join('/')}
                    </p>
                  </div>
                  <ChevronRight size={15} style={{ color: 'var(--muted-foreground)' }} />
                </button>
              ))}
            </div>
          ) : (
            <div
              className="rounded-xl border border-dashed border-border p-4 flex items-center gap-3"
              style={{ borderStyle: 'dashed' }}
            >
              <Layers size={16} style={{ color: 'var(--muted-foreground)', opacity: 0.5 }} />
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Sin jornadas abiertas. Usa «Auditar por bloque» para iniciar una.
              </p>
            </div>
          )}
        </section>

        {/* ── Cola de trabajo ────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <TituloSeccion as="p" className="mb-0">
              {filtro ? (FILTRO_LABELS[filtro] ?? 'Filtrado') : 'Cola de trabajo'}
            </TituloSeccion>
            {filtro && (
              <button
                onClick={() => setFiltro(null)}
                className="text-small font-semibold px-2.5 py-0.5 rounded-md"
                style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
              >
                Ver todos
              </button>
            )}
          </div>

          {loadingDash ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-card rounded-xl border border-border p-4 space-y-2.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-4 w-20 rounded-full" />
                    <Skeleton className="h-4 w-28 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : errorDash ? (
            <div className="rounded-xl border border-dashed border-border p-6 flex flex-col items-center gap-3">
              <AlertCircle size={24} style={{ color: 'var(--muted-foreground)', opacity: 0.5 }} />
              <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
                No se pudo cargar la cola de trabajo.
              </p>
              <button
                onClick={() => setRefreshKey(k => k + 1)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
              >
                <RefreshCw size={12} />
                Reintentar
              </button>
            </div>
          ) : colaFiltrada.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 flex flex-col items-center gap-2">
              <CheckCircle2 size={28} style={{ color: 'var(--muted-foreground)', opacity: 0.4 }} />
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Sin acciones pendientes
              </p>
              <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
                {filtro ? 'Sin items con este filtro.' : '¡Todo al día!'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {itemsVencidos.length > 0 && (
                <div className="flex flex-col gap-2">
                  <TituloSeccion
                    as="p"
                    variante="subtitulo"
                    className="mb-0 flex items-center gap-1 text-agro-danger-text"
                  >
                    <AlertCircle size={10} />
                    Vencidas · {itemsVencidos.length}
                  </TituloSeccion>
                  {itemsVencidos.map((item, index) => (
                    <WorkQueueCard
                      key={`${item.entity_type}-${item.entity_id}`}
                      index={index}
                      reducedMotion={reducedMotion}
                      item={item}
                      orgNombre={item.organization_id ? (orgNombreMap.get(item.organization_id) ?? null) : null}
                      hoy={hoy}
                      onClick={() => { clicksBeforeResumeRef.current++; navigate(item.route) }}
                    />
                  ))}
                </div>
              )}

              {itemsResto.length > 0 && (
                <div className="flex flex-col gap-2">
                  {itemsVencidos.length > 0 && (
                    <TituloSeccion as="p" variante="subtitulo" className="mb-0">
                      Pendientes · {itemsResto.length}
                    </TituloSeccion>
                  )}
                  {itemsResto.map((item, index) => (
                    <WorkQueueCard
                      key={`${item.entity_type}-${item.entity_id}`}
                      index={index}
                      reducedMotion={reducedMotion}
                      item={item}
                      orgNombre={item.organization_id ? (orgNombreMap.get(item.organization_id) ?? null) : null}
                      hoy={hoy}
                      onClick={() => { clicksBeforeResumeRef.current++; navigate(item.route) }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Organizaciones asignadas ───────────────────────────────── */}
        {!loadingOrgs && orgs.length > 0 && (
          <section>
            <TituloSeccion as="p">Organizaciones</TituloSeccion>
            <div className="flex flex-col gap-2">
              {orgs.map(org => (
                <button
                  key={org.org_id}
                  onClick={() => navigate(`/auditor/org/${org.org_id}`, { state: { orgNombre: org.nombre } })}
                  className="w-full text-left bg-card rounded-xl border border-border p-4 flex items-center gap-3 hover:bg-muted active:opacity-70 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--muted)' }}
                  >
                    <Building2 size={16} style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                      {org.nombre}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {org.num_ranchos} {org.num_ranchos === 1 ? 'instalación' : 'instalaciones'}
                      {org.tipo ? ` · ${org.tipo}` : ''}
                    </p>
                  </div>
                  <ChevronRight size={15} style={{ color: 'var(--muted-foreground)' }} />
                </button>
              ))}
            </div>
          </section>
        )}

      </main>

      <Fab onClick={() => setShowSheet(true)} aria-label="Nueva auditoría" />

      {showSheet && (
        <AuditorNuevaAuditoriaSheet
          onClose={() => setShowSheet(false)}
          onCreated={() => { setShowSheet(false); setRefreshKey(k => k + 1) }}
        />
      )}

      <Outlet />
    </div>
  )
}
