import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { Settings } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useChecklist, type ChkItem, type ChkTipoItem } from '@/hooks/useChecklist'
import { EncabezadoPantalla } from '@/app/components/EncabezadoPantalla'
import { Fab } from '@/app/components/Fab'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { ItemCard } from '@/app/components/checklist/ItemCard'
import { ItemDetalleSheet } from '@/app/components/checklist/ItemDetalleSheet'
import { AgregarSheet } from '@/app/components/checklist/AgregarSheet'
import { AjustesSheet } from '@/app/components/checklist/AjustesSheet'
import { VisitaCard } from '@/app/components/checklist/VisitaCard'
import { VisitaAccionSheet, VisitasSheet, type ModoVisita } from '@/app/components/checklist/VisitaSheets'
import { hoyMX } from '@/lib/fecha'
import { cn } from '@/app/components/ui/utils'

type FiltroChk = 'faltantes' | 'no_se_lleva' | 'firmas' | 'por_vencer'

const CLAVE_SITIO = 'mady-checklist-sitio'

const GRUPOS: { tipo: ChkTipoItem; titulo: string }[] = [
  { tipo: 'modulo', titulo: 'Formatos de la app' },
  { tipo: 'formato', titulo: 'Formatos fuera de la app' },
  { tipo: 'documento', titulo: 'Documentos' },
]

function leerSitioGuardado(): string | null {
  try { return localStorage.getItem(CLAVE_SITIO) } catch { return null }
}
function guardarSitio(id: string) {
  try { localStorage.setItem(CLAVE_SITIO, id) } catch { /* sin storage */ }
}

function coincide(item: ChkItem, f: FiltroChk): boolean {
  const t = item.notas ?? []
  switch (f) {
    case 'faltantes': return t.some(n => n.tipo === 'faltan_registros')
    case 'no_se_lleva': return t.some(n => n.tipo === 'no_se_lleva')
    case 'firmas': return t.some(n => n.tipo === 'faltan_firmas')
    case 'por_vencer': return t.some(n => n.tipo === 'por_vencer' || n.tipo === 'vencido')
  }
}

export function ChecklistDocumentos() {
  const { profile, codigoClave } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const { ranchos, loading: loadingRanchos } = useRanchos()
  const hook = useChecklist()
  const [searchParams, setSearchParams] = useSearchParams()

  const rol = profile?.rol
  const permitido = rol === 'admin_org' || rol === 'asesor_tecnico'

  const sitioParam = searchParams.get('sitio')
  const sitioId = useMemo(() => {
    if (!ranchos.length) return null
    if (sitioParam && ranchos.some(r => r.id === sitioParam)) return sitioParam
    const guardado = leerSitioGuardado()
    if (guardado && ranchos.some(r => r.id === guardado)) return guardado
    return ranchos[0].id
  }, [ranchos, sitioParam])

  const [filtro, setFiltro] = useState<FiltroChk | null>(null)
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const [modoRevisar, setModoRevisar] = useState(false)
  const [agregarAbierto, setAgregarAbierto] = useState(false)
  const [ajustesAbierto, setAjustesAbierto] = useState(false)
  const [modoVisita, setModoVisita] = useState<ModoVisita | null>(null)
  const [visitasAbierto, setVisitasAbierto] = useState(false)
  const visitaParam = searchParams.get('visita')

  const { cargar } = hook
  useEffect(() => {
    if (permitido && sitioId) cargar(sitioId)
  }, [permitido, sitioId, cargar])

  // Enlace de la campana (?visita=): abre la lista con esa visita desplegada
  const { resumen: resumenCargado } = hook
  useEffect(() => {
    if (visitaParam && resumenCargado?.visitas.some(v => v.id === visitaParam)) setVisitasAbierto(true)
  }, [visitaParam, resumenCargado])

  const recargar = useCallback(() => { if (sitioId) cargar(sitioId) }, [sitioId, cargar])

  function elegirSitio(id: string) {
    guardarSitio(id)
    setFiltro(null)
    const p = new URLSearchParams(searchParams)
    p.set('sitio', id)
    p.delete('visita')
    setSearchParams(p, { replace: true })
  }

  const { resumen } = hook
  const puedeEditar = rol === 'admin_org' && !!resumen?.puede_editar
  const items = resumen?.items ?? []
  const itemsFiltrados = filtro ? items.filter(i => coincide(i, filtro)) : items
  const detalle = items.find(i => i.id === detalleId) ?? null
  const visitas = resumen?.visitas ?? []
  const programadas = visitas.filter(v => v.estado === 'programada').sort((a, b) => a.fecha.localeCompare(b.fecha))
  const proxima = programadas[0] ?? null
  const hoy = resumen?.hoy ?? hoyMX()
  // Visita abierta: la del enlace o la primera programada con fecha de hoy o anterior
  const abierta = programadas.find(v => v.id === visitaParam) ?? programadas.find(v => v.fecha <= hoy) ?? null

  if (!profile) return null
  if (!permitido) return <Navigate to="/" replace />

  const c = resumen?.contadores
  const pildoras: { clave: FiltroChk; label: string; n: number }[] = [
    { clave: 'faltantes', label: 'Con faltantes', n: c?.con_faltantes ?? 0 },
    { clave: 'no_se_lleva', label: 'No se lleva', n: c?.no_se_lleva ?? 0 },
    { clave: 'firmas', label: 'Faltan firmas', n: c?.faltan_firmas ?? 0 },
    { clave: 'por_vencer', label: 'Documentos por vencer', n: c?.documentos_por_vencer ?? 0 },
  ]

  return (
    <div className="min-h-full pb-safe-nav bg-background">
      <EncabezadoPantalla
        titulo="Checklist"
        acciones={puedeEditar && sitioId ? (
          <button
            type="button"
            onClick={() => setAjustesAbierto(true)}
            className="p-2 rounded-lg text-muted-foreground transition-colors hover:bg-muted active:scale-95"
            aria-label="Ajustes del sitio"
          >
            <Settings className="w-5 h-5" />
          </button>
        ) : undefined}
      />

      <div className="px-4 py-4 space-y-4 max-w-3xl mx-auto">
        {ranchos.length > 1 && (
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">{terminosSitio.singular}</span>
            <select
              value={sitioId ?? ''}
              onChange={e => elegirSitio(e.target.value)}
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
            >
              {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </label>
        )}

        {!loadingRanchos && ranchos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">
            Aún no hay {terminosSitio.pluralSimple.toLowerCase()} registrados.
          </p>
        )}

        {resumen && (
          <VisitaCard
            visita={proxima}
            puedeEditar={puedeEditar}
            hayVisitas={visitas.length > 0}
            onProgramar={() => setModoVisita({ tipo: 'programar' })}
            onTerminar={() => proxima && setModoVisita({ tipo: 'terminar', visita: proxima })}
            onReprogramar={() => proxima && setModoVisita({ tipo: 'reprogramar', visita: proxima })}
            onCancelar={() => proxima && setModoVisita({ tipo: 'cancelar', visita: proxima })}
            onVerVisitas={() => setVisitasAbierto(true)}
          />
        )}

        {c && (
          <div className="flex flex-wrap gap-2">
            {pildoras.map(p => {
              const activa = filtro === p.clave
              return (
                <button
                  key={p.clave}
                  type="button"
                  onClick={() => setFiltro(activa ? null : p.clave)}
                  aria-pressed={activa}
                  className={cn(
                    'h-8 px-3 rounded-full border text-xs transition-colors active:scale-[0.97]',
                    activa ? 'border-transparent' : 'bg-card border-border text-foreground hover:bg-muted',
                  )}
                  style={activa ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 600 } : undefined}
                >
                  {p.label} · {p.n}
                </button>
              )
            })}
            {c.visitas_atrasadas > 0 && (
              <button
                type="button"
                onClick={() => setVisitasAbierto(true)}
                className="h-8 px-3 rounded-full border text-xs transition-colors active:scale-[0.97]"
                style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)', borderColor: 'transparent', fontWeight: 600 }}
              >
                Visitas atrasadas · {c.visitas_atrasadas}
              </button>
            )}
          </div>
        )}

        {(hook.loading && !resumen) || loadingRanchos ? (
          <ListaSkeleton rows={5} />
        ) : hook.error ? (
          <div className="rounded-xl border border-border bg-card p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">{hook.error}</p>
            <button type="button" onClick={recargar} className="text-sm" style={{ color: 'var(--primary)', fontWeight: 600 }}>
              Reintentar
            </button>
          </div>
        ) : resumen ? (
          itemsFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {filtro ? 'Nada coincide con este filtro.' : 'El checklist de este sitio está vacío.'}
            </p>
          ) : (
            GRUPOS.map(g => {
              const lista = itemsFiltrados.filter(i => i.tipo === g.tipo)
              if (lista.length === 0) return null
              return (
                <section key={g.tipo} className="space-y-2">
                  <h2 className="text-xs uppercase tracking-wide text-muted-foreground" style={{ fontWeight: 600 }}>{g.titulo}</h2>
                  <div className="space-y-3">
                    {lista.map(item => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        codigoClave={codigoClave}
                        puedeEditar={puedeEditar}
                        onAbrir={() => { setModoRevisar(false); setDetalleId(item.id) }}
                        onRevisar={() => { setModoRevisar(true); setDetalleId(item.id) }}
                      />
                    ))}
                  </div>
                </section>
              )
            })
          )
        ) : null}
      </div>

      {puedeEditar && sitioId && <Fab onClick={() => setAgregarAbierto(true)} aria-label="Agregar al checklist" />}

      {sitioId && (
        <>
          <ItemDetalleSheet
            item={detalle}
            modoRevisar={modoRevisar}
            ranchoId={sitioId}
            codigoClave={codigoClave}
            puedeEditar={puedeEditar}
            sinActividad={resumen?.sin_actividad ?? []}
            visitaAbierta={abierta ? { id: abierta.id, fecha: abierta.fecha } : null}
            hook={hook}
            onClose={() => setDetalleId(null)}
            onCambio={recargar}
          />
          <VisitasSheet
            open={visitasAbierto}
            visitas={visitas}
            destacada={visitaParam ?? proxima?.id ?? null}
            hook={hook}
            codigoClave={codigoClave}
            terminoSitio={terminosSitio.singular}
            onClose={() => setVisitasAbierto(false)}
          />
          {puedeEditar && (
            <>
              <VisitaAccionSheet
                modo={modoVisita}
                ranchoId={sitioId}
                hook={hook}
                codigoClave={codigoClave}
                terminoSitio={terminosSitio.singular}
                onClose={() => setModoVisita(null)}
                onGuardado={recargar}
              />
              <AgregarSheet
                open={agregarAbierto}
                ranchoId={sitioId}
                hook={hook}
                onClose={() => setAgregarAbierto(false)}
                onGuardado={recargar}
              />
              <AjustesSheet
                open={ajustesAbierto}
                ranchoId={sitioId}
                diasIniciales={resumen?.config.dias_operacion ?? [1, 2, 3, 4, 5, 6, 7]}
                resumenInicial={resumen?.config.resumen_semanal ?? false}
                sinActividad={resumen?.sin_actividad ?? []}
                hook={hook}
                onClose={() => setAjustesAbierto(false)}
                onGuardado={recargar}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
