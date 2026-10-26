import { useState, useEffect, useRef } from 'react'
import { useNavigate, Navigate, Outlet } from 'react-router'
import { motion, LayoutGroup, useReducedMotion } from 'motion/react'
import {
  Building2,
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
import { Boton } from '@/app/components/ui-mady/Boton'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { FilaNavegable } from './FilaNavegable'
import { Skeleton } from '@/app/components/ui/skeleton'
import { TarjetaContador } from '@/app/components/ui-mady/TarjetaContador'
import { Etiqueta, type TonoEtiqueta } from '@/app/components/ui-mady/Etiqueta'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { entrada } from './motionAuditor'

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
      <FilaNavegable
        onClick={onClick}
        titulo={item.title}
        lineasTitulo={2}
        tono={vencida ? 'vencida' : 'normal'}
        pie={(
          <span className="flex flex-wrap items-center gap-1.5">
            {vencida && (
              <Etiqueta tono="error" icono={<AlertCircle size={10} />}>Vencida</Etiqueta>
            )}
            {item.next_action_code !== 'SIN_ACCION' && (
              <Etiqueta tono={accionTono(item.next_action_code)}>
                {ACCION_LABELS[item.next_action_code] ?? item.next_action_code}
              </Etiqueta>
            )}
            {orgNombre && (
              <span className="text-caption text-muted-foreground">{orgNombre}</span>
            )}
          </span>
        )}
      />
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
      <h1 className="sr-only hidden md:block">{`Hola, ${profile?.nombre_completo?.split(' ')[0] ?? '—'}`}</h1>
      <header className="md:hidden sticky top-0 z-20 bg-card border-b border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-foreground truncate font-semibold">{`Hola, ${profile?.nombre_completo?.split(' ')[0] ?? '—'}`}</p>
            <p className="text-xs text-muted-foreground">Auditores · M.A.D.Y</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Boton variante="icono" onClick={() => navigate('/auditor/agenda?tab=calendario')} aria-label="Calendario">
              <Calendar size={16} style={{ color: 'var(--muted-foreground)' }} />
            </Boton>
            <AuditorCampana />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 py-4 flex flex-col gap-5 lg:grid lg:grid-cols-3 lg:items-start lg:gap-x-6 lg:max-w-6xl lg:mx-auto">

        {/* Buscador — móvil (en escritorio vive en el header del Layout) */}
        <div className="md:hidden">
          <AuditorBusqueda />
        </div>

        {/* Escritorio (lg): izquierda = trabajo (2/3); derecha = visitas, jornadas y organizaciones (1/3).
            En celular y tableta los envoltorios desaparecen (contents) y `order` conserva el orden de siempre. */}
        <div className="contents lg:col-span-2 lg:flex lg:flex-col lg:gap-5">
        {/* ── Continuar trabajo ──────────────────────────────────────── */}
        {workspace && (
          <section className="order-1">
            <FilaNavegable
              onClick={() => { markResume(clicksBeforeResumeRef.current); navigate(workspace.route) }}
              tono="destacada"
              icono={<PlayCircle size={18} />}
              encima="Continuar trabajo"
              titulo={workspace.titulo}
            />
          </section>
        )}

        {/* ── Franja de resumen ──────────────────────────────────────── */}
        {loadingDash ? (
          <section className="order-2">
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
          <section className="order-2">
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

        {/* ── Cola de trabajo ────────────────────────────────────────── */}
        <section className="order-5">
          <div className="flex items-center justify-between mb-2.5">
            <TituloSeccion as="p" className="mb-0">
              {filtro ? (FILTRO_LABELS[filtro] ?? 'Filtrado') : 'Cola de trabajo'}
            </TituloSeccion>
            {filtro && (
              <Boton variante="secundario" tamano="sm" onClick={() => setFiltro(null)}>
                Ver todos
              </Boton>
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
            <EstadoVacio
              icono={AlertCircle}
              titulo="No se pudo cargar la cola de trabajo."
              accion={(
                <Boton variante="secundario" onClick={() => setRefreshKey(k => k + 1)}>
                  <RefreshCw size={14} />
                  Reintentar
                </Boton>
              )}
            />
          ) : colaFiltrada.length === 0 ? (
            <EstadoVacio
              icono={CheckCircle2}
              titulo="Sin acciones pendientes"
              ayuda={filtro ? 'Sin items con este filtro.' : '¡Todo al día!'}
            />
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
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-5">
        {/* ── Visitas de hoy ─────────────────────────────────────────── */}
        {resumen && resumen.visitas_hoy.length > 0 && (
          <section className="order-3">
            <TituloSeccion as="p">Visitas de hoy</TituloSeccion>
            <div className="flex flex-col gap-2">
              {resumen.visitas_hoy.map(v => (
                <FilaNavegable
                  key={v.agenda_id}
                  onClick={() => navigate(`/auditor/auditoria/${v.auditoria_id}`)}
                  icono={<Calendar size={15} />}
                  titulo={v.titulo}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Jornadas abiertas + Auditar por bloque ─────────────────── */}
        <section className="order-4">
          <div className="flex items-center justify-between mb-2.5">
            <TituloSeccion as="p" className="mb-0">Captura por bloque</TituloSeccion>
            <Boton variante="secundario" tamano="sm" onClick={() => navigate('/auditor/jornada/nueva')}>
              <Layers size={13} />
              Auditar por bloque
            </Boton>
          </div>
          {jornadasAbiertas.length > 0 ? (
            <div className="flex flex-col gap-2">
              {jornadasAbiertas.map(j => (
                <FilaNavegable
                  key={j.jornada_id}
                  onClick={() => navigate(`/auditor/jornada/${j.jornada_id}`)}
                  icono={<Layers size={15} />}
                  titulo={j.nombre}
                  subtitulo={`${j.operaciones.length} ${j.operaciones.length === 1 ? 'operación' : 'operaciones'} · ${j.fecha.split('-').reverse().join('/')}`}
                />
              ))}
            </div>
          ) : (
            <EstadoVacio
              icono={Layers}
              titulo="Sin jornadas abiertas."
              ayuda="Usa «Auditar por bloque» para iniciar una."
            />
          )}
        </section>

        {/* ── Organizaciones asignadas ───────────────────────────────── */}
        {!loadingOrgs && orgs.length > 0 && (
          <section className="order-6">
            <TituloSeccion as="p">Organizaciones</TituloSeccion>
            <div className="flex flex-col gap-2">
              {orgs.map(org => (
                <FilaNavegable
                  key={org.org_id}
                  onClick={() => navigate(`/auditor/org/${org.org_id}`, { state: { orgNombre: org.nombre } })}
                  icono={<Building2 size={16} />}
                  iconoTono="neutro"
                  titulo={org.nombre}
                  subtitulo={`${org.num_ranchos} ${org.num_ranchos === 1 ? 'instalación' : 'instalaciones'}${org.tipo ? ` · ${org.tipo}` : ''}`}
                />
              ))}
            </div>
          </section>
        )}
        </div>

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
