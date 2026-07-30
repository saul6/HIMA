import { useMemo } from 'react'
import { Link } from 'react-router'
import {
  Plus, CheckCircle, Clock, Loader2, TriangleAlert, Clock3,
  Users, AlertTriangle, ChevronRight,
} from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { useHomeDashboard } from '@/hooks/useHomeDashboard'
import { useCorreccionesPendientes } from '@/hooks/useCorreccionesPendientes'
import { useModulosContext } from '@/context/ModulosContext'
import { resolverIcono } from '@/app/components/iconos-modulos'
import { MadyLogo } from '@/app/components/MadyLogo'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFechaCorta(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short',
    })
  } catch {
    return iso
  }
}

function formatHa(ha: number): string {
  if (ha === 0) return '0'
  return ha % 1 === 0 ? String(ha) : ha.toFixed(1)
}

function formatDias(dias: number | null): string {
  if (dias === null) return '—'
  if (dias === 0) return 'Hoy'
  if (dias === 1) return '1 día'
  return `${dias} días`
}

// ── Pantalla ──────────────────────────────────────────────────────────────────

export function Home() {
  const { profile } = useAuthContext()
  const { orgNombre, orgPlan, metricas, recientes, loading, error } = useHomeDashboard()
  const { items: correcciones, count: countCorrecciones } = useCorreccionesPendientes()
  const { modulos, loading: loadingModulos, error: errorModulos, refetch: refetchModulos } = useModulosContext()

  const esAdmin = profile?.rol === 'admin_org'

  const tieneAplicaciones = modulos.some(m => m.clave === 'aplicaciones')

  const modulosAgrupados = useMemo(() => {
    const grupos: { key: string; nombre: string; modulos: typeof modulos }[] = []

    const visibles = modulos.filter(m => m.mostrar_en_menu)

    const transversales = visibles.filter(m => m.es_transversal).sort((a, b) => a.orden - b.orden)
    if (transversales.length > 0) {
      grupos.push({ key: 'general', nombre: 'General', modulos: transversales })
    }

    const sectorMap = new Map<string, { nombre: string; orden: number; modulos: typeof modulos }>()
    for (const m of visibles.filter(m => !m.es_transversal)) {
      if (!m.sector_clave) continue
      if (!sectorMap.has(m.sector_clave)) {
        sectorMap.set(m.sector_clave, { nombre: m.sector_nombre!, orden: m.sector_orden!, modulos: [] })
      }
      sectorMap.get(m.sector_clave)!.modulos.push(m)
    }

    for (const [clave, data] of Array.from(sectorMap.entries()).sort(([, a], [, b]) => a.orden - b.orden)) {
      grupos.push({
        key: clave,
        nombre: data.nombre,
        modulos: data.modulos.sort((a, b) => a.orden - b.orden),
      })
    }

    return grupos
  }, [modulos])
  const nombreUsuario = profile?.nombre_completo ?? '—'
  const nombreOrg = orgNombre ?? '—'

  const hayActividad = recientes.length > 0

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">

      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-between gap-3 w-full">
          {/* Contenedor del logo para asegurar que quede bien alineado a la izquierda */}
          <div className="flex items-center flex-shrink-0">
            <MadyLogo theme="light" className="h-15 w-auto flex-shrink-0" />
          </div>

          {/* Información del usuario y organización */}
          <div className="text-right min-w-0 flex-1 ml-3">
            <div className="text-sm text-foreground truncate font-semibold">
              {loading ? '...' : nombreUsuario}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {loading ? '...' : nombreOrg}
            </div>
          </div>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">

        {/* Banner de cuenta pendiente de activación */}
        {!loading && orgPlan === 'pendiente' && (
          <div
            className="flex items-start gap-3 rounded-xl p-4"
            style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid var(--agro-amber)' }}
          >
            <Clock3 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
            <div>
              <p className="text-sm" style={{ color: 'var(--agro-warning-text)', fontWeight: 600 }}>
                Tu cuenta está pendiente de activación
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--agro-warning-text)' }}>
                Si ya realizaste tu pago, en breve activaremos tu plan. ¿Dudas?{' '}
                <a
                  href="mailto:contacto@duomindsolutions.com"
                  className="underline"
                  style={{ color: 'var(--agro-warning-text)' }}
                >
                  Contáctanos
                </a>
                .
              </p>
            </div>
          </div>
        )}

        {/* Error de carga */}
        {error && !loading && (
          <div
            className="flex items-start gap-2 rounded-xl p-3"
            style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}
          >
            <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
            <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
              Error al cargar el dashboard. Verifica tu conexión.
            </p>
          </div>
        )}

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-3">

          {/* Aplicaciones este mes */}
          <div className="bg-card rounded-xl p-4 border border-border">
            {loading ? (
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin mb-1" />
            ) : (
              <div className="text-2xl mb-1" style={{ fontWeight: 600 }}>
                {metricas.appsMes}
              </div>
            )}
            <div className="text-xs text-muted-foreground">Aplicaciones este mes</div>
          </div>

          {/* Productos distintos usados */}
          <div className="bg-card rounded-xl p-4 border border-border">
            {loading ? (
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin mb-1" />
            ) : (
              <div className="text-2xl mb-1" style={{ fontWeight: 600 }}>
                {metricas.productosDistintos}
              </div>
            )}
            <div className="text-xs text-muted-foreground">Productos distintos usados</div>
          </div>

          {/* Días desde última aplicación */}
          <div className="bg-card rounded-xl p-4 border border-border">
            {loading ? (
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin mb-1" />
            ) : (
              <div className="text-2xl mb-1" style={{ fontWeight: 600 }}>
                {formatDias(metricas.diasDesdeUltimaApp)}
              </div>
            )}
            <div className="text-xs text-muted-foreground">Desde última aplicación</div>
          </div>

          {/* Superficie activa */}
          <div className="bg-card rounded-xl p-4 border border-border">
            {loading ? (
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin mb-1" />
            ) : (
              <div className="text-2xl mb-1" style={{ fontWeight: 600 }}>
                {formatHa(metricas.superficieHa)} ha
              </div>
            )}
            <div className="text-xs text-muted-foreground">Superficie activa</div>
          </div>

        </div>

        {/* Correcciones pendientes — visible para todos si tienen correcciones */}
        {!loading && countCorrecciones > 0 && (
          <div
            className="rounded-xl overflow-hidden border"
            style={{ borderColor: 'var(--agro-amber)' }}
          >
            <div
              className="px-4 py-3 flex items-center gap-2"
              style={{ backgroundColor: 'var(--agro-warning-fill)' }}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--agro-warning-text)' }} />
              <span className="text-sm flex-1" style={{ color: 'var(--agro-warning-text)', fontWeight: 600 }}>
                {countCorrecciones} {countCorrecciones === 1 ? 'registro requiere' : 'registros requieren'} tu corrección
              </span>
            </div>
            <div className="bg-card divide-y divide-border">
              {correcciones.slice(0, 3).map((item) => (
                <div key={`${item.tabla}-${item.id}`} className="px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-0.5">{item.moduloLabel} · {item.rancho_nombre}</p>
                  <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                    {item.comentario_correccion ?? 'Revisa este registro'}
                  </p>
                </div>
              ))}
              {countCorrecciones > 3 && (
                <div className="px-4 py-2">
                  <p className="text-xs text-muted-foreground">+{countCorrecciones - 3} más</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Acceso rápido al equipo — solo admin_org */}
        {esAdmin && !loading && (
          <Link
            to="/equipo/actividad"
            className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-primary transition-colors"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Actividad del equipo</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ver registros de todos los empleados
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </Link>
        )}

        {/* Actividad reciente */}
        <div>
          <h2 className="mb-3 text-foreground" style={{ fontWeight: 600 }}>Actividad reciente</h2>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : !hayActividad ? (
            <div className="bg-card border border-border rounded-xl p-6 text-center">
              <p className="text-sm text-muted-foreground" style={{ fontWeight: 600 }}>
                Sin actividad aún
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Registra tu primer rancho y crea una aplicación para ver el historial aquí.
              </p>
              <Link
                to="/nueva-aplicacion"
                className="inline-block mt-3 h-9 px-4 rounded-xl text-sm text-white bg-primary hover:bg-agro-blue transition-colors"
                style={{ lineHeight: '36px', fontWeight: 600 }}
              >
                Nueva aplicación
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recientes.map((app) => {
                const productosTexto = app.productos.length === 0
                  ? 'Sin productos registrados'
                  : app.productos.length === 1
                    ? app.productos[0]
                    : `${app.productos[0]} +${app.productos.length - 1}`

                return (
                  <Link
                    key={app.id}
                    to={`/historial/${app.id}`}
                    className="block bg-card rounded-xl p-4 border border-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            {formatFechaCorta(app.fecha)}
                          </span>
                          {app.status === 'completado' ? (
                            <span
                              className="text-xs px-2 py-0.5 rounded flex items-center gap-1"
                              style={{
                                backgroundColor: 'var(--agro-success-fill)',
                                color: 'var(--agro-success-text)',
                                fontWeight: 600,
                              }}
                            >
                              <CheckCircle className="w-3 h-3" />
                              Completado
                            </span>
                          ) : (
                            <span
                              className="text-xs px-2 py-0.5 rounded flex items-center gap-1"
                              style={{
                                backgroundColor: 'var(--agro-warning-fill)',
                                color: 'var(--agro-warning-text)',
                                fontWeight: 600,
                              }}
                            >
                              <Clock className="w-3 h-3" />
                              Borrador
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                          {productosTexto}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Inocuidad y BPAs */}
        <div>
          <h2 className="mb-3 text-foreground" style={{ fontWeight: 600 }}>Inocuidad y BPAs</h2>

          {loadingModulos ? (
            <div className="space-y-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="bg-card rounded-xl p-4 border border-border animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 rounded w-3/4" style={{ backgroundColor: 'var(--muted)' }} />
                      <div className="h-2 rounded w-1/2" style={{ backgroundColor: 'var(--muted)' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : errorModulos ? (
            <div
              className="flex items-center gap-2 rounded-xl p-3"
              style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}
            >
              <TriangleAlert className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--agro-danger-text)' }} />
              <p className="text-xs flex-1" style={{ color: 'var(--agro-danger-text)' }}>
                Error al cargar módulos.{' '}
                <button className="underline" onClick={refetchModulos}>Reintentar</button>
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {modulosAgrupados.map(grupo => (
                <div key={grupo.key}>
                  {modulosAgrupados.length > 1 && (
                    <p
                      className="text-xs text-muted-foreground mb-2 px-1 uppercase tracking-wide"
                      style={{ fontWeight: 600 }}
                    >
                      {grupo.nombre}
                    </p>
                  )}
                  <div className="space-y-2">
                    {grupo.modulos.map(modulo => {
                      const Icon = resolverIcono(modulo.icono)
                      return (
                        <Link
                          key={modulo.codigo}
                          to={modulo.ruta}
                          className="block bg-card rounded-xl p-4 border border-border"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                                {modulo.nombre}
                              </div>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* FAB — solo si el sector incluye aplicaciones de plaguicidas */}
      {tieneAplicaciones && (
        <Link
          to="/nueva-aplicacion"
          className="fixed bottom-[calc(72px+34px+16px)] right-4 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg z-10 hover:bg-agro-blue transition-colors"
          style={{ maxWidth: 'calc(390px - 32px - 56px + 56px)' }}
          aria-label="Nueva aplicación"
        >
          <Plus className="w-6 h-6 text-white" />
        </Link>
      )}
    </div>
  )
}
