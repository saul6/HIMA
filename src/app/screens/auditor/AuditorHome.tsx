import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router'
import {
  Building2, ChevronRight, Plus,
  AlertCircle, Calendar, CheckCircle2, RefreshCw,
} from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { useAuditorAsignaciones } from '@/hooks/useAuditorAsignaciones'
import { supabase } from '@/lib/supabase'
import { hoyMX } from '@/lib/fecha'
import { AuditorNuevaAuditoriaSheet } from './AuditorNuevaAuditoriaSheet'
import { AuditorCampana } from './AuditorCampana'

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

function accionChipStyle(code: string): React.CSSProperties {
  switch (code) {
    case 'CORREGIR_AC':
      return { backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }
    case 'CREAR_ACCION_CORRECTIVA':
    case 'COMPLETAR_AC':
      return { backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }
    case 'VALIDAR_PARA_AZZULE':
    case 'ABRIR_MODO_AZZULE':
      return { backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }
    default:
      return { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }
  }
}

function esVencida(item: WorkQueueItem, hoy: string): boolean {
  return item.priority === 1 || (!!item.due_at && item.due_at < hoy)
}

function WorkQueueCard({
  item,
  orgNombre,
  hoy,
  onClick,
}: {
  item: WorkQueueItem
  orgNombre: string | null
  hoy: string
  onClick: () => void
}) {
  const vencida = esVencida(item, hoy)
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card rounded-xl border p-4 flex flex-col gap-2 active:opacity-70 transition-opacity"
      style={{
        borderColor: vencida ? 'var(--agro-danger-text)' : 'var(--border)',
        borderWidth: vencida ? '1.5px' : undefined,
      }}
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 text-sm font-medium leading-snug" style={{ color: 'var(--foreground)' }}>
          {item.title}
        </p>
        <ChevronRight size={15} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--muted-foreground)' }} />
      </div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {vencida && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}
          >
            <AlertCircle size={9} />
            Vencida
          </span>
        )}
        {item.next_action_code !== 'SIN_ACCION' && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
            style={accionChipStyle(item.next_action_code)}
          >
            {ACCION_LABELS[item.next_action_code] ?? item.next_action_code}
          </span>
        )}
        {orgNombre && (
          <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
            {orgNombre}
          </span>
        )}
      </div>
    </button>
  )
}

export function AuditorHome() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()
  const { orgs, loading: loadingOrgs } = useAuditorAsignaciones()

  const [cola, setCola] = useState<WorkQueueItem[]>([])
  const [resumen, setResumen] = useState<DashboardResumen | null>(null)
  const [loadingDash, setLoadingDash] = useState(true)
  const [errorDash, setErrorDash] = useState(false)
  const [filtro, setFiltro] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showSheet, setShowSheet] = useState(false)

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

      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b border-border flex items-center gap-3 px-4 py-3"
        style={{ backgroundColor: 'var(--card)' }}
      >
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            Inicio
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {profile?.nombre_completo?.split(' ')[0] ?? '—'} · Auditor
          </p>
        </div>
        <button
          onClick={() => setShowSheet(true)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
        >
          <Plus size={13} />
          Nueva
        </button>
        <AuditorCampana />
      </header>

      <main className="flex-1 px-4 py-4 flex flex-col gap-5">

        {/* ── Franja de resumen ──────────────────────────────────────── */}
        {!loadingDash && resumen && (
          <section>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">

              <button
                onClick={() => setFiltro(f => f === '__vencidas__' ? null : '__vencidas__')}
                className="flex-shrink-0 rounded-xl px-3 py-2 flex flex-col items-center gap-0.5 min-w-[70px] transition-colors"
                style={{
                  backgroundColor: filtro === '__vencidas__' ? 'var(--agro-danger-text)' : 'var(--agro-danger-fill)',
                  color: filtro === '__vencidas__' ? '#fff' : 'var(--agro-danger-text)',
                }}
              >
                <span className="text-xl font-bold leading-none">{resumen.vencidas}</span>
                <span className="text-[10px] font-medium leading-tight whitespace-nowrap">Vencidas</span>
              </button>

              <button
                onClick={() => setFiltro(f => f === 'VALIDAR_PARA_AZZULE' ? null : 'VALIDAR_PARA_AZZULE')}
                className="flex-shrink-0 rounded-xl px-3 py-2 flex flex-col items-center gap-0.5 min-w-[70px] transition-colors"
                style={{
                  backgroundColor: filtro === 'VALIDAR_PARA_AZZULE' ? 'var(--agro-warning-text)' : 'var(--agro-warning-fill)',
                  color: filtro === 'VALIDAR_PARA_AZZULE' ? '#fff' : 'var(--agro-warning-text)',
                }}
              >
                <span className="text-xl font-bold leading-none">{resumen.por_validar}</span>
                <span className="text-[10px] font-medium leading-tight whitespace-nowrap">Por validar</span>
              </button>

              <button
                onClick={() => setFiltro(f => f === 'ABRIR_MODO_AZZULE' ? null : 'ABRIR_MODO_AZZULE')}
                className="flex-shrink-0 rounded-xl px-3 py-2 flex flex-col items-center gap-0.5 min-w-[70px] transition-colors"
                style={{
                  backgroundColor: filtro === 'ABRIR_MODO_AZZULE' ? 'var(--primary)' : 'var(--agro-success-fill)',
                  color: filtro === 'ABRIR_MODO_AZZULE' ? '#fff' : 'var(--agro-success-text)',
                }}
              >
                <span className="text-xl font-bold leading-none">{resumen.listas_azzule}</span>
                <span className="text-[10px] font-medium leading-tight whitespace-nowrap">Listas Azzule</span>
              </button>

              <button
                onClick={() => setFiltro(f => f === 'VERIFICAR_ESTADO_AZZULE' ? null : 'VERIFICAR_ESTADO_AZZULE')}
                className="flex-shrink-0 rounded-xl px-3 py-2 flex flex-col items-center gap-0.5 min-w-[70px] transition-colors"
                style={{
                  backgroundColor: filtro === 'VERIFICAR_ESTADO_AZZULE' ? 'var(--muted-foreground)' : 'var(--muted)',
                  color: filtro === 'VERIFICAR_ESTADO_AZZULE' ? '#fff' : 'var(--muted-foreground)',
                }}
              >
                <span className="text-xl font-bold leading-none">{resumen.seguimiento_azzule}</span>
                <span className="text-[10px] font-medium leading-tight whitespace-nowrap">Seguimiento</span>
              </button>

              <button
                onClick={() => setFiltro(null)}
                className="flex-shrink-0 rounded-xl px-3 py-2 flex flex-col items-center gap-0.5 min-w-[70px] transition-colors"
                style={{
                  backgroundColor: !filtro ? 'var(--primary)' : 'var(--muted)',
                  color: !filtro ? '#fff' : 'var(--muted-foreground)',
                }}
              >
                <span className="text-xl font-bold leading-none">{resumen.total_pendiente}</span>
                <span className="text-[10px] font-medium leading-tight whitespace-nowrap">Total</span>
              </button>

            </div>
          </section>
        )}

        {/* ── Visitas de hoy ─────────────────────────────────────────── */}
        {resumen && resumen.visitas_hoy.length > 0 && (
          <section>
            <p
              className="text-[11px] font-semibold uppercase tracking-wide mb-2.5"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Visitas de hoy
            </p>
            <div className="flex flex-col gap-2">
              {resumen.visitas_hoy.map(v => (
                <button
                  key={v.agenda_id}
                  onClick={() => navigate(`/auditor/auditoria/${v.auditoria_id}`)}
                  className="w-full text-left bg-card rounded-xl border border-border p-3 flex items-center gap-3 active:opacity-70 transition-opacity"
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

        {/* ── Cola de trabajo ────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <p
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {filtro ? (FILTRO_LABELS[filtro] ?? 'Filtrado') : 'Cola de trabajo'}
            </p>
            {filtro && (
              <button
                onClick={() => setFiltro(null)}
                className="text-[10px] font-semibold px-2.5 py-0.5 rounded-md"
                style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
              >
                Ver todos
              </button>
            )}
          </div>

          {loadingDash ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-[72px] rounded-xl animate-pulse"
                  style={{ backgroundColor: 'var(--muted)' }}
                />
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
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1"
                    style={{ color: 'var(--agro-danger-text)' }}
                  >
                    <AlertCircle size={10} />
                    Vencidas · {itemsVencidos.length}
                  </p>
                  {itemsVencidos.map(item => (
                    <WorkQueueCard
                      key={`${item.entity_type}-${item.entity_id}`}
                      item={item}
                      orgNombre={item.organization_id ? (orgNombreMap.get(item.organization_id) ?? null) : null}
                      hoy={hoy}
                      onClick={() => navigate(item.route)}
                    />
                  ))}
                </div>
              )}

              {itemsResto.length > 0 && (
                <div className="flex flex-col gap-2">
                  {itemsVencidos.length > 0 && (
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      Pendientes · {itemsResto.length}
                    </p>
                  )}
                  {itemsResto.map(item => (
                    <WorkQueueCard
                      key={`${item.entity_type}-${item.entity_id}`}
                      item={item}
                      orgNombre={item.organization_id ? (orgNombreMap.get(item.organization_id) ?? null) : null}
                      hoy={hoy}
                      onClick={() => navigate(item.route)}
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
            <p
              className="text-[11px] font-semibold uppercase tracking-wide mb-2.5"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Organizaciones
            </p>
            <div className="flex flex-col gap-2">
              {orgs.map(org => (
                <button
                  key={org.org_id}
                  onClick={() => navigate(`/auditor/org/${org.org_id}`, { state: { orgNombre: org.nombre } })}
                  className="w-full text-left bg-card rounded-xl border border-border p-4 flex items-center gap-3 active:opacity-70 transition-opacity"
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

      {showSheet && (
        <AuditorNuevaAuditoriaSheet
          onClose={() => setShowSheet(false)}
          onCreated={() => { setShowSheet(false); setRefreshKey(k => k + 1) }}
        />
      )}
    </div>
  )
}
