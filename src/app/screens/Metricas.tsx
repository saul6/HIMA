import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { BarChart3, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Clock, TrendingUp } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useMetricas } from '@/hooks/useMetricas'
import { hoyMX } from '@/lib/fecha'
import type {
  MetProductividad,
  MetAgenda,
  MetCumplimiento,
  MetConstancia,
  MetCampo,
  ColaboradorProductividad,
} from '@/hooks/useMetricas'

// ── Helpers de fechas ────────────────────────────────────────────────────────

type PeriodoKey = 'este_mes' | 'mes_anterior' | 'ultimos_3' | 'este_anio' | 'personalizado'

function calcularPeriodo(key: PeriodoKey): { desde: string; hasta: string } {
  const hoy = hoyMX()
  const [anio, mes] = hoy.split('-').map(Number)
  if (key === 'este_mes') {
    const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`
    return { desde: inicio, hasta: hoy }
  }
  if (key === 'mes_anterior') {
    const mesAnt = mes === 1 ? 12 : mes - 1
    const anioAnt = mes === 1 ? anio - 1 : anio
    const inicio = `${anioAnt}-${String(mesAnt).padStart(2, '0')}-01`
    const ultimo = new Date(anio, mes - 1, 0).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
    return { desde: inicio, hasta: ultimo }
  }
  if (key === 'ultimos_3') {
    const d = new Date()
    d.setMonth(d.getMonth() - 3)
    const desde = d.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
    return { desde, hasta: hoy }
  }
  if (key === 'este_anio') {
    return { desde: `${anio}-01-01`, hasta: hoy }
  }
  return { desde: hoy, hasta: hoy }
}

const PERIODOS: { key: PeriodoKey; label: string }[] = [
  { key: 'este_mes', label: 'Este mes' },
  { key: 'mes_anterior', label: 'Mes anterior' },
  { key: 'ultimos_3', label: 'Últimos 3 meses' },
  { key: 'este_anio', label: 'Este año' },
  { key: 'personalizado', label: 'Personalizado' },
]

const ROL_LABELS: Record<string, string> = {
  admin_org: 'Admin', super_admin: 'Super Admin',
  asesor_tecnico: 'Asesor', operario: 'Operario', auditor: 'Auditor',
}

// ── Chip de estado ────────────────────────────────────────────────────────────

function ChipPct({ pct }: { pct: number }) {
  let color = 'var(--agro-success-text)'
  let bg = 'var(--agro-success-fill)'
  if (pct < 70) { color = 'var(--agro-danger-text)'; bg = 'var(--agro-danger-fill)' }
  else if (pct < 90) { color = 'var(--agro-warning-text)'; bg = 'var(--agro-warning-fill)' }
  return (
    <span className="text-xs px-1.5 py-0.5 rounded-md tabular-nums" style={{ color, backgroundColor: bg }}>
      {pct.toFixed(0)}%
    </span>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-md animate-pulse ${className}`}
      style={{ backgroundColor: 'var(--muted)' }}
    />
  )
}

function TabSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}

// ── Vacío ─────────────────────────────────────────────────────────────────────

function Vacio({ mensaje = 'Sin datos en este periodo' }: { mensaje?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <BarChart3 className="w-10 h-10" style={{ color: 'var(--muted-foreground)' }} />
      <p className="text-sm text-muted-foreground">{mensaje}</p>
    </div>
  )
}

// ── Tarjeta resumen ───────────────────────────────────────────────────────────

function TarjetaResumen({ label, valor, sub }: { label: string; valor: string | number; sub?: string }) {
  return (
    <div className="rounded-xl p-4 border border-border bg-card flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl tabular-nums" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
        {valor}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ── Pestaña Productividad ─────────────────────────────────────────────────────

function TabProductividad({
  datos,
  modulos,
  esAdmin,
}: {
  datos: MetProductividad
  modulos: { codigo: string; nombre: string }[]
  esAdmin: boolean
}) {
  const [expandido, setExpandido] = useState<string | null>(null)

  const colaboradores = datos.colaboradores ?? []
  if (colaboradores.length === 0) return <Vacio />

  const maxCapturas = Math.max(...colaboradores.map(c => c.capturas), 1)
  const totalCol = datos.total_colaboradores ?? colaboradores.length
  const v = datos.verificacion

  // Totales para tarjetas admin
  const totalCapturas = colaboradores.reduce((s, c) => s + c.capturas, 0)
  const totalCorrecciones = colaboradores.reduce((s, c) => s + (c.correcciones ?? 0), 0)
  const pctCorreccion = totalCapturas > 0 ? (totalCorrecciones / totalCapturas) * 100 : 0
  const colConCapturas = datos.colaboradores_con_capturas ?? colaboradores.filter(c => c.capturas > 0).length

  // Datos propios para tarjetas no-admin
  const mr = datos.mi_resumen
  const miPosicion = colaboradores.find(c => c.es_yo)?.posicion

  return (
    <div className="space-y-4 pb-8">
      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        {esAdmin ? (
          <>
            <TarjetaResumen label="Total capturas" valor={totalCapturas.toLocaleString('es-MX')} />
            <TarjetaResumen
              label="Colaboradores con capturas"
              valor={`${colConCapturas} de ${totalCol}`}
            />
            <TarjetaResumen
              label="Con corrección"
              valor={`${pctCorreccion.toFixed(1)}%`}
              sub={`${totalCorrecciones} registros`}
            />
          </>
        ) : (
          <>
            <TarjetaResumen
              label="Mis capturas"
              valor={(mr?.capturas ?? 0).toLocaleString('es-MX')}
            />
            <TarjetaResumen
              label="Mi posición"
              valor={miPosicion != null ? `#${miPosicion} de ${totalCol}` : '—'}
            />
            <TarjetaResumen
              label="Con corrección"
              valor={mr?.pct_correccion != null ? `${mr.pct_correccion.toFixed(1)}%` : '—'}
            />
          </>
        )}
        {v && (
          <TarjetaResumen
            label="Verificados"
            valor={v.verificados}
            sub={`${v.pendientes_verificar} pendientes${v.horas_promedio != null ? ` · ${v.horas_promedio.toFixed(1)} h prom.` : ''}`}
          />
        )}
      </div>

      {/* Ranking */}
      <div className="px-4">
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted-foreground)' }}>
          RANKING DE COLABORADORES
        </p>
        <div className="space-y-2">
          {colaboradores.map((c: ColaboradorProductividad) => {
            const tieneDetalle = c.detalle_visible
            const tieneDesglose = tieneDetalle && c.por_modulo != null && Object.keys(c.por_modulo).length > 0
            const abierto = expandido === c.profile_id && tieneDesglose
            const pct = (c.capturas / maxCapturas) * 100
            const porModuloEntries = tieneDesglose
              ? Object.entries(c.por_modulo!).sort((a, b) => b[1] - a[1])
              : []

            // Posición — acento para los 3 primeros con capturas > 0
            const esPodio = c.capturas > 0 && c.posicion <= 3
            let posBg = 'transparent'
            let posColor = 'var(--muted-foreground)'
            if (esPodio) {
              if (c.posicion === 1) { posBg = 'var(--primary)'; posColor = '#fff' }
              else if (c.posicion === 2) { posBg = 'var(--agro-warning-fill)'; posColor = 'var(--agro-warning-text)' }
              else { posBg = 'var(--muted)'; posColor = 'var(--foreground)' }
            }

            const rowInner = (
              <div className="flex items-start gap-2">
                {/* Posición */}
                <span
                  className="text-xs tabular-nums font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 text-center mt-0.5"
                  style={{ backgroundColor: posBg, color: posColor, minWidth: '2rem' }}
                >
                  #{c.posicion}
                </span>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="min-w-0 flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                        {c.nombre}
                      </span>
                      {c.es_yo && (
                        <span
                          className="text-xs font-semibold px-1 py-0.5 rounded"
                          style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                        >
                          Tú
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {ROL_LABELS[c.rol] ?? c.rol}
                      </span>
                      {!c.activo && (
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          Inactivo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-sm tabular-nums font-semibold" style={{ color: 'var(--primary)' }}>
                        {c.capturas.toLocaleString('es-MX')}
                      </span>
                      {tieneDesglose && (
                        abierto
                          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Barra horizontal */}
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--muted)' }}>
                    <div
                      className="h-full rounded-full origin-left"
                      style={{
                        backgroundColor: 'var(--primary)',
                        transform: `scaleX(${pct / 100})`,
                        transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1)',
                      }}
                    />
                  </div>

                  {/* Detalles — solo si visible */}
                  {tieneDetalle && (
                    <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                      {c.capturas > 0 ? (
                        <>
                          <span>
                            {(c.correcciones ?? 0) > 0
                              ? `${(c.pct_correccion ?? 0).toFixed(1)}% corrección`
                              : 'Sin correcciones'}
                          </span>
                          {(c.sin_firma ?? 0) > 0 && (
                            <span style={{ color: 'var(--agro-warning-text)' }}>
                              {c.sin_firma} sin firma
                            </span>
                          )}
                        </>
                      ) : (
                        <span>Sin capturas en este periodo</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )

            return (
              <div
                key={c.profile_id}
                className="rounded-xl border border-border overflow-hidden"
                style={{
                  backgroundColor: c.es_yo ? 'var(--agro-success-fill)' : 'var(--card)',
                  opacity: !c.activo ? 0.6 : undefined,
                }}
              >
                {tieneDesglose ? (
                  <button
                    className="w-full text-left px-4 py-3"
                    onClick={() => setExpandido(abierto ? null : c.profile_id)}
                    aria-expanded={abierto}
                  >
                    {rowInner}
                  </button>
                ) : (
                  <div className="px-4 py-3">{rowInner}</div>
                )}

                {/* Desglose por módulo */}
                {abierto && porModuloEntries.length > 0 && (
                  <div
                    className="px-4 pb-3 pt-0 border-t border-border"
                    style={{ backgroundColor: 'var(--muted)' }}
                  >
                    <p className="text-xs font-semibold mt-2 mb-2" style={{ color: 'var(--muted-foreground)' }}>
                      DESGLOSE POR MÓDULO
                    </p>
                    <div className="space-y-1">
                      {porModuloEntries.map(([codigo, n]) => {
                        const mod = modulos.find(m => m.codigo === codigo)
                        return (
                          <div key={codigo} className="flex items-center justify-between text-sm">
                            <span style={{ color: 'var(--foreground)' }}>
                              {mod ? mod.nombre : codigo}
                            </span>
                            <span className="tabular-nums" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                              {(n as number).toLocaleString('es-MX')}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Pestaña Agenda ────────────────────────────────────────────────────────────

function TabAgenda({ datos }: { datos: MetAgenda }) {
  const colaboradores = datos.colaboradores ?? []
  if (colaboradores.length === 0) return <Vacio />

  return (
    <div className="space-y-3 px-4 pt-4 pb-8">
      {colaboradores.map(c => {
        const pctATiempo = c.cerradas > 0 ? (c.a_tiempo / c.cerradas) * 100 : null
        return (
          <div key={c.profile_id} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{c.nombre}</p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Asignadas</p>
                <p className="tabular-nums font-semibold" style={{ color: 'var(--foreground)' }}>{c.asignadas}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cerradas</p>
                <p className="tabular-nums font-semibold" style={{ color: 'var(--foreground)' }}>{c.cerradas}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">% a tiempo</p>
                {pctATiempo != null
                  ? <ChipPct pct={pctATiempo} />
                  : <span className="text-xs text-muted-foreground">—</span>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vencidas</p>
                <p
                  className="tabular-nums font-semibold"
                  style={{ color: c.vencidas_abiertas > 0 ? 'var(--agro-danger-text)' : 'var(--foreground)' }}
                >
                  {c.vencidas_abiertas}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Regresadas</p>
                <p className="tabular-nums font-semibold" style={{ color: 'var(--foreground)' }}>{c.regresadas}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Días prom.</p>
                <p className="tabular-nums font-semibold" style={{ color: 'var(--foreground)' }}>
                  {c.dias_promedio_cierre != null ? c.dias_promedio_cierre.toFixed(1) : '—'}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Pestaña Cumplimiento ──────────────────────────────────────────────────────

function TabCumplimiento({ datos }: { datos: MetCumplimiento }) {
  const internas = datos.internas ?? []
  const externas = datos.externas ?? []
  const fallas = datos.fallas_recurrentes ?? []
  const porMes = datos.incidencias?.por_mes ?? {}
  const meses = Object.keys(porMes).sort()
  const maxVal = Math.max(...Object.values(porMes), 1)

  if (internas.length === 0 && externas.length === 0 && fallas.length === 0) {
    return <Vacio />
  }

  return (
    <div className="space-y-6 px-4 pt-4 pb-8">
      {/* Auditorías internas */}
      {internas.length > 0 && (
        <section>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--muted-foreground)' }}>
            AUDITORÍAS INTERNAS
          </p>
          {/* Promedios */}
          {datos.internas_promedio && Object.keys(datos.internas_promedio).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(datos.internas_promedio).map(([mod, pct]) => (
                <div key={mod} className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">{mod}:</span>
                  <ChipPct pct={pct as number} />
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            {internas.map((a, i) => {
              const pct = a.porcentaje
              let color = 'var(--foreground)'
              if (pct < 70) color = 'var(--agro-danger-text)'
              else if (pct < 80) color = 'var(--agro-warning-text)'
              return (
                <div key={i} className="rounded-xl border border-border bg-card p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{a.nombre}</p>
                    <p className="text-xs text-muted-foreground">{a.rancho} · {a.fecha}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm tabular-nums font-semibold" style={{ color }}>
                      {pct.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">{a.puntos}/{a.posibles} pts</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Auditorías externas */}
      {externas.length > 0 && (
        <section>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--muted-foreground)' }}>
            AUDITORÍAS EXTERNAS
          </p>
          <div className="space-y-2">
            {externas.map((a, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{a.fecha}</p>
                  <span className="text-xs px-2 py-0.5 rounded-md" style={{
                    backgroundColor: a.resultado === 'aprobado' ? 'var(--agro-success-fill)' : 'var(--agro-danger-fill)',
                    color: a.resultado === 'aprobado' ? 'var(--agro-success-text)' : 'var(--agro-danger-text)',
                  }}>
                    {a.resultado}
                  </span>
                </div>
                {a.falla_automatica && (
                  <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
                    ⚠ Falla automática
                  </p>
                )}
                {a.nc_abiertas > 0 && (
                  <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                    {a.nc_abiertas} NC{a.nc_abiertas > 1 ? 's' : ''} abiertas
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Incidencias M13 por mes */}
      {meses.length > 0 && (
        <section>
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>
            INCIDENCIAS M13 POR MES
          </p>
          {datos.incidencias && (
            <p className="text-xs text-muted-foreground mb-3">
              {datos.incidencias.reportes} reportes · {datos.incidencias.incidencias} incidencias
            </p>
          )}
          <div className="flex items-end gap-2 h-24">
            {meses.map(mes => {
              const n = porMes[mes] ?? 0
              const h = Math.max((n / maxVal) * 80, n > 0 ? 4 : 0)
              return (
                <div key={mes} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <span className="text-xs tabular-nums" style={{ color: 'var(--muted-foreground)' }}>{n}</span>
                  <div
                    className="w-full rounded-sm"
                    style={{
                      height: `${h}px`,
                      backgroundColor: 'var(--primary)',
                      opacity: 0.7,
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                    {mes.slice(5)}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Fallas recurrentes */}
      {fallas.length > 0 && (
        <section>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--muted-foreground)' }}>
            PUNTOS DE FALLA RECURRENTES (TOP {fallas.length})
          </p>
          <div className="space-y-1.5">
            {fallas.map((f, i) => (
              <div key={i} className="flex items-start justify-between gap-3 py-1.5 border-b border-border last:border-0">
                <div className="min-w-0">
                  <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                    {f.modulo}
                  </span>
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>{f.punto}</p>
                </div>
                <span className="text-sm tabular-nums flex-shrink-0 font-semibold" style={{ color: 'var(--agro-danger-text)' }}>
                  ×{f.veces}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Pestaña Constancia ────────────────────────────────────────────────────────

function formatFechaCorta(fecha: string): string {
  const [, mes, dia] = fecha.split('-')
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${parseInt(dia)} ${meses[parseInt(mes) - 1]}`
}

function TabConstancia({ datos }: { datos: MetConstancia }) {
  const modulos = datos.modulos ?? []
  if (modulos.length === 0) return (
    <Vacio mensaje="Sin módulos con frecuencia fija en este periodo" />
  )

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <div className="space-y-2">
        {modulos.map((m, i) => {
          const huecos = m.huecos_recientes ?? []
          return (
            <div key={`${m.modulo}-${m.rancho_id}-${i}`} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{m.nombre}</p>
                  <p className="text-xs text-muted-foreground">{m.rancho} · {m.frecuencia}</p>
                </div>
                <div className="text-right flex-shrink-0 space-y-1">
                  <ChipPct pct={m.pct} />
                  <p className="text-xs text-muted-foreground tabular-nums">{m.cubiertos}/{m.esperados}</p>
                </div>
              </div>
              {huecos.length > 0 && (
                <div className="px-3 pb-3 border-t border-border pt-2" style={{ backgroundColor: 'var(--muted)' }}>
                  <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                    Sin registro: {huecos.map(formatFechaCorta).join(', ')}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground pt-2">
        Solo módulos con frecuencia fija; los de por evento no se miden aquí.
      </p>
    </div>
  )
}

// ── Pestaña Campo ─────────────────────────────────────────────────────────────

function TabCampo({ datos }: { datos: MetCampo }) {
  const porMes = datos.aplicaciones_por_mes ?? {}
  const meses = Object.keys(porMes).sort()
  const productosTop = datos.productos_top ?? []
  const cosechasEnIntervalo = datos.cosechas_en_intervalo ?? []

  const maxAplicaciones = Math.max(...meses.map(m => porMes[m]?.aplicaciones ?? 0), 1)

  if (meses.length === 0 && productosTop.length === 0) return <Vacio />

  return (
    <div className="space-y-6 px-4 pt-4 pb-8">
      {/* Aplicaciones por mes */}
      {meses.length > 0 && (
        <section>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--muted-foreground)' }}>
            APLICACIONES POR MES
          </p>
          <div className="flex items-end gap-2 h-28">
            {meses.map(mes => {
              const apl = porMes[mes]?.aplicaciones ?? 0
              const ha = porMes[mes]?.ha ?? 0
              const h = Math.max((apl / maxAplicaciones) * 96, apl > 0 ? 4 : 0)
              return (
                <div key={mes} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <span className="text-[10px] tabular-nums" style={{ color: 'var(--muted-foreground)' }}>{apl}</span>
                  <div
                    className="w-full rounded-sm"
                    style={{ height: `${h}px`, backgroundColor: 'var(--primary)', opacity: 0.8 }}
                  />
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                    {mes.slice(5)}
                  </span>
                  {ha > 0 && (
                    <span className="text-[9px] tabular-nums text-muted-foreground">{ha.toFixed(1)} ha</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Top productos */}
      {productosTop.length > 0 && (
        <section>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--muted-foreground)' }}>
            TOP PRODUCTOS
          </p>
          <div className="space-y-2">
            {productosTop.map((p, i) => {
              const maxP = productosTop[0]?.aplicaciones ?? 1
              const pct = (p.aplicaciones / maxP) * 100
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate" style={{ color: 'var(--foreground)' }}>{p.producto}</span>
                    <span className="tabular-nums flex-shrink-0 ml-2 text-xs" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      {p.aplicaciones}
                    </span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--muted)' }}>
                    <div
                      className="h-full rounded-full origin-left"
                      style={{
                        backgroundColor: 'var(--primary)',
                        transform: `scaleX(${pct / 100})`,
                        opacity: 0.7,
                        transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1)',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Cosechas en intervalo de seguridad */}
      {cosechasEnIntervalo.length > 0 && (
        <section>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--agro-danger-text)' }}>
            COSECHAS DENTRO DEL INTERVALO DE SEGURIDAD
          </p>
          <div className="space-y-2">
            {cosechasEnIntervalo.map((c, i) => (
              <div
                key={i}
                className="rounded-xl border p-3 space-y-1"
                style={{ borderColor: 'var(--agro-danger-fill)', backgroundColor: 'var(--agro-danger-fill)' }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color: 'var(--agro-danger-text)' }}>
                    {c.rancho}
                  </p>
                  <span className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>{c.sector}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
                  Cosecha: {c.fecha} · Aplic.: {c.aplicacion_fecha}
                </p>
                <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
                  Permitida desde: {c.cosecha_permitida_desde}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Filtros ───────────────────────────────────────────────────────────────────

interface FiltrosProps {
  periodo: PeriodoKey
  setPeriodo: (p: PeriodoKey) => void
  desdePersonalizado: string
  hastaPersonalizado: string
  setDesdePersonalizado: (v: string) => void
  setHastaPersonalizado: (v: string) => void
  ranchoId: string
  setRanchoId: (v: string) => void
  ranchos: { id: string; nombre: string }[]
  terminoSingular: string
  esAdmin: boolean
  pestanaActiva: string
}

function Filtros({
  periodo, setPeriodo,
  desdePersonalizado, hastaPersonalizado,
  setDesdePersonalizado, setHastaPersonalizado,
  ranchoId, setRanchoId,
  ranchos, terminoSingular, esAdmin, pestanaActiva,
}: FiltrosProps) {
  const mostrarRancho = esAdmin && pestanaActiva !== 'agenda'
  return (
    <div
      className="sticky top-0 z-10 px-4 py-3 border-b border-border space-y-3"
      style={{ backgroundColor: 'var(--card)' }}
    >
      {/* Selector de periodo */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {PERIODOS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriodo(p.key)}
            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors"
            style={{
              backgroundColor: periodo === p.key ? 'var(--primary)' : 'var(--muted)',
              color: periodo === p.key ? '#fff' : 'var(--muted-foreground)',
              fontWeight: periodo === p.key ? 600 : 400,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Fechas personalizadas */}
      {periodo === 'personalizado' && (
        <div className="flex gap-2">
          <input
            type="date"
            value={desdePersonalizado}
            onChange={e => setDesdePersonalizado(e.target.value)}
            className="flex-1 h-9 px-3 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: 'var(--input-background)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          />
          <input
            type="date"
            value={hastaPersonalizado}
            onChange={e => setHastaPersonalizado(e.target.value)}
            className="flex-1 h-9 px-3 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: 'var(--input-background)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          />
        </div>
      )}

      {/* Selector de rancho */}
      {mostrarRancho && (
        <select
          value={ranchoId}
          onChange={e => setRanchoId(e.target.value)}
          className="w-full h-9 px-3 rounded-lg text-sm outline-none"
          style={{
            backgroundColor: 'var(--input-background)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
          }}
        >
          <option value="">Todos los {terminoSingular.toLowerCase()}s</option>
          {ranchos.map(r => (
            <option key={r.id} value={r.id}>{r.nombre}</option>
          ))}
        </select>
      )}
    </div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

type PestanaKey = 'productividad' | 'agenda' | 'cumplimiento' | 'constancia' | 'campo'

interface PestanaConfig { key: PestanaKey; label: string; icon: React.ReactNode }

export function Metricas() {
  const navigate = useNavigate()
  const { profile } = useAuthContext()
  const { modulos, terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { cargarProductividad, cargarAgenda, cargarCumplimiento, cargarConstancia, cargarCampo } = useMetricas()

  const esAdmin = profile?.rol === 'admin_org' || profile?.rol === 'super_admin'
  const tieneCampo = modulos.some(m => m.sector_clave === 'campo')

  // Redirigir auditor
  useEffect(() => {
    if (profile?.rol === 'auditor') navigate('/auditor', { replace: true })
  }, [profile?.rol, navigate])

  // Estado de filtros
  const hoy = hoyMX()
  const [periodo, setPeriodo] = useState<PeriodoKey>('este_mes')
  const [desdePersonalizado, setDesdePersonalizado] = useState(hoy)
  const [hastaPersonalizado, setHastaPersonalizado] = useState(hoy)
  const [ranchoId, setRanchoId] = useState('')

  // Pestañas disponibles
  const pestanas: PestanaConfig[] = [
    { key: 'productividad', label: 'Productividad', icon: <TrendingUp className="w-4 h-4" /> },
    { key: 'agenda', label: 'Agenda', icon: <Clock className="w-4 h-4" /> },
    ...(esAdmin ? [
      { key: 'cumplimiento' as PestanaKey, label: 'Cumplimiento', icon: <CheckCircle2 className="w-4 h-4" /> },
      { key: 'constancia' as PestanaKey, label: 'Constancia', icon: <BarChart3 className="w-4 h-4" /> },
      ...(tieneCampo ? [{ key: 'campo' as PestanaKey, label: 'Campo', icon: <AlertTriangle className="w-4 h-4" /> }] : []),
    ] : []),
  ]

  const [pestanaActiva, setPestanaActiva] = useState<PestanaKey>('productividad')

  // Datos por pestaña
  const [datosProd, setDatosProd] = useState<MetProductividad | null>(null)
  const [datosAgenda, setDatosAgenda] = useState<MetAgenda | null>(null)
  const [datosCumpl, setDatosCumpl] = useState<MetCumplimiento | null>(null)
  const [datosConst, setDatosConst] = useState<MetConstancia | null>(null)
  const [datosCampo, setDatosCampo] = useState<MetCampo | null>(null)
  const [cargando, setCargando] = useState(false)

  const resolverFechas = useCallback((): { desde: string; hasta: string } => {
    if (periodo === 'personalizado') {
      return { desde: desdePersonalizado || hoy, hasta: hastaPersonalizado || hoy }
    }
    return calcularPeriodo(periodo)
  }, [periodo, desdePersonalizado, hastaPersonalizado, hoy])

  const cargarPestana = useCallback(async (pestana: PestanaKey) => {
    const { desde, hasta } = resolverFechas()
    const rancho = ranchoId || null
    setCargando(true)
    try {
      if (pestana === 'productividad') {
        const d = await cargarProductividad(desde, hasta, rancho)
        setDatosProd(d)
      } else if (pestana === 'agenda') {
        const d = await cargarAgenda(desde, hasta)
        setDatosAgenda(d)
      } else if (pestana === 'cumplimiento') {
        const d = await cargarCumplimiento(desde, hasta, rancho)
        setDatosCumpl(d)
      } else if (pestana === 'constancia') {
        const d = await cargarConstancia(desde, hasta, rancho)
        setDatosConst(d)
      } else if (pestana === 'campo') {
        const d = await cargarCampo(desde, hasta, rancho)
        setDatosCampo(d)
      }
    } finally {
      setCargando(false)
    }
  }, [resolverFechas, ranchoId, cargarProductividad, cargarAgenda, cargarCumplimiento, cargarConstancia, cargarCampo])

  // Cargar al montar y al cambiar filtros o pestaña
  useEffect(() => {
    if (profile?.rol === 'auditor') return
    cargarPestana(pestanaActiva)
  }, [pestanaActiva, periodo, desdePersonalizado, hastaPersonalizado, ranchoId]) // eslint-disable-line react-hooks/exhaustive-deps

  const modulosParaDesglose = modulos.map(m => ({ codigo: m.codigo, nombre: m.nombre }))

  function renderContenido() {
    if (cargando) return <TabSkeleton />

    if (pestanaActiva === 'productividad') {
      if (!datosProd) return <Vacio />
      return <TabProductividad datos={datosProd} modulos={modulosParaDesglose} esAdmin={esAdmin} />
    }
    if (pestanaActiva === 'agenda') {
      if (!datosAgenda) return <Vacio />
      return <TabAgenda datos={datosAgenda} />
    }
    if (pestanaActiva === 'cumplimiento') {
      if (!datosCumpl) return <Vacio />
      if (datosCumpl.permitido === false) return <Vacio mensaje="No tienes permiso para ver esta sección" />
      return <TabCumplimiento datos={datosCumpl} />
    }
    if (pestanaActiva === 'constancia') {
      if (!datosConst) return <Vacio />
      if (datosConst.permitido === false) return <Vacio mensaje="No tienes permiso para ver esta sección" />
      return <TabConstancia datos={datosConst} />
    }
    if (pestanaActiva === 'campo') {
      if (!datosCampo) return <Vacio />
      if (datosCampo.permitido === false) return <Vacio mensaje="No tienes permiso para ver esta sección" />
      return <TabCampo datos={datosCampo} />
    }
    return null
  }

  if (profile?.rol === 'auditor') return null

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header móvil */}
      <div className="flex items-center gap-3 px-4 py-4 md:hidden border-b border-border" style={{ backgroundColor: 'var(--card)' }}>
        <BarChart3 className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--primary)' }} />
        <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          {esAdmin ? 'Métricas' : 'Mis métricas'}
        </h1>
      </div>

      {/* Filtros */}
      <Filtros
        periodo={periodo}
        setPeriodo={p => { setPeriodo(p) }}
        desdePersonalizado={desdePersonalizado}
        hastaPersonalizado={hastaPersonalizado}
        setDesdePersonalizado={setDesdePersonalizado}
        setHastaPersonalizado={setHastaPersonalizado}
        ranchoId={ranchoId}
        setRanchoId={setRanchoId}
        ranchos={ranchos}
        terminoSingular={terminosSitio.singular}
        esAdmin={esAdmin}
        pestanaActiva={pestanaActiva}
      />

      {/* Pestañas */}
      <div
        className="flex gap-1 overflow-x-auto no-scrollbar px-4 py-2 border-b border-border flex-shrink-0"
        style={{ backgroundColor: 'var(--card)' }}
      >
        {pestanas.map(p => {
          const activa = pestanaActiva === p.key
          return (
            <button
              key={p.key}
              onClick={() => setPestanaActiva(p.key)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors"
              style={{
                backgroundColor: activa ? 'var(--primary)' : 'var(--muted)',
                color: activa ? '#fff' : 'var(--muted-foreground)',
                fontWeight: activa ? 600 : 400,
              }}
            >
              {p.icon}
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto">
        {renderContenido()}
      </div>
    </div>
  )
}
