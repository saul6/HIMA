import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { Settings } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useChecklist, type ChkItem, type ChkTipoItem } from '@/hooks/useChecklist'
import { EncabezadoPantalla } from '@/app/components/EncabezadoPantalla'
import { Fab } from '@/app/components/Fab'
import { FiltroPildoras } from '@/app/components/FiltroPildoras'
import { ChecklistSkeleton } from '@/app/components/checklist/ChecklistSkeleton'
import { ContadorPildora } from '@/app/components/checklist/ContadorPildora'
import { useMostrarCarga } from '@/hooks/useMostrarCarga'
import { ItemCard } from '@/app/components/checklist/ItemCard'
import { ItemDetalleSheet } from '@/app/components/checklist/ItemDetalleSheet'
import { AgregarSheet } from '@/app/components/checklist/AgregarSheet'
import { AjustesSheet } from '@/app/components/checklist/AjustesSheet'
import { VisitaCard } from '@/app/components/checklist/VisitaCard'
import { VisitaAccionSheet, VisitasSheet, type ModoVisita } from '@/app/components/checklist/VisitaSheets'
import { hoyMX } from '@/lib/fecha'

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

  const reducedMotion = useReducedMotion()
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
  const cargandoInicial = (hook.loading && !resumen) || loadingRanchos
  const mostrarSkeleton = useMostrarCarga(cargandoInicial, !!resumen)
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

  const botonAjustes = (clases: string) => puedeEditar && sitioId ? (
    <button
      type="button"
      onClick={() => setAjustesAbierto(true)}
      className={`p-2 rounded-lg text-muted-foreground transition-colors hover:bg-muted active:scale-95 ${clases}`}
      aria-label="Ajustes del sitio"
    >
      <Settings className="w-5 h-5" />
    </button>
  ) : undefined

  return (
    <div className="min-h-full pb-safe-nav bg-background">
      <EncabezadoPantalla
        titulo="Checklist"
        accionesEscritorio="contenido"
        acciones={botonAjustes('md:hidden')}
      />

      <div className="p-4 space-y-4">
        {/* Primera fila: sitio, visita y engrane. xl: los tres en una fila; md: sitio arriba, visita y engrane abajo; celular: apilados (engrane en el header) */}
        {(ranchos.length > 1 || resumen) && (
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            {ranchos.length > 1 && (
              <label className="block space-y-1 xl:w-72 xl:flex-shrink-0">
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
            {(resumen || (puedeEditar && sitioId)) && (
              <div className="flex items-stretch gap-3 min-w-0 xl:flex-1">
                {resumen && (
                  <div className="flex-1 min-w-0">
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
                  </div>
                )}
                {botonAjustes('hidden md:flex self-stretch items-center px-3 rounded-xl border border-border bg-card')}
              </div>
            )}
          </div>
        )}

        {!loadingRanchos && ranchos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">
            Aún no hay {terminosSitio.pluralSimple.toLowerCase()} registrados.
          </p>
        )}

        {c && (
          <div className="flex flex-wrap gap-2">
            <FiltroPildoras<string>
              groupId="checklist-filtro"
              value={filtro ?? ''}
              onChange={v => setFiltro(filtro === v ? null : (v as FiltroChk))}
              options={pildoras.map(p => ({
                value: p.clave,
                label: <>{p.label} · <ContadorPildora n={p.n} /></>,
              }))}
            />
            {c.visitas_atrasadas > 0 && (
              <button
                type="button"
                onClick={() => setVisitasAbierto(true)}
                className="h-9 px-4 rounded-full border text-sm transition-colors active:scale-[0.97]"
                style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)', borderColor: 'transparent', fontWeight: 600 }}
              >
                Visitas atrasadas · {c.visitas_atrasadas}
              </button>
            )}
          </div>
        )}

        {cargandoInicial ? (
          mostrarSkeleton ? <ChecklistSkeleton /> : null
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
            // Al cambiar de sitio o de filtro la lista entra con un fade
            <motion.div
              key={`${sitioId}-${filtro ?? 'todos'}`}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {GRUPOS.map(g => {
                const lista = itemsFiltrados.filter(i => i.tipo === g.tipo)
                if (lista.length === 0) return null
                return (
                  <section key={g.tipo} className="space-y-2">
                    <h2 className="text-xs uppercase tracking-wide text-muted-foreground" style={{ fontWeight: 600 }}>{g.titulo}</h2>
                    <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
                      {lista.map((item, i) => (
                        <motion.div
                          key={item.id}
                          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: reducedMotion ? 0 : Math.min(i, 8) * 0.03 }}
                        >
                          <ItemCard
                            item={item}
                            codigoClave={codigoClave}
                            puedeEditar={puedeEditar}
                            onAbrir={() => { setModoRevisar(false); setDetalleId(item.id) }}
                            onRevisar={() => { setModoRevisar(true); setDetalleId(item.id) }}
                          />
                        </motion.div>
                      ))}
                    </div>
                  </section>
                )
              })}
            </motion.div>
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
