import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router'
import { ChevronLeft, Copy, CheckCircle, Loader, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { AudHallazgo, AudAccionCorrectivaCAPA, AudHallazgoClasificacion } from '@/types/database.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

interface AzzuleItem {
  hallazgo: AudHallazgo
  accion: AudAccionCorrectivaCAPA
  marcada: boolean
}

const CLASIFICACION_LABEL: Record<AudHallazgoClasificacion, string> = {
  menor:       'Menor',
  mayor:       'Mayor',
  critico:     'Crítico',
  observacion: 'Observación',
}

function buildRespuestaText(accion: AudAccionCorrectivaCAPA): string {
  const partes: string[] = []
  if (accion.condicion_inicial)     partes.push(`Condición inicial:\n${accion.condicion_inicial}`)
  if (accion.correccion_inmediata)  partes.push(`Corrección inmediata:\n${accion.correccion_inmediata}`)
  if (accion.causa_raiz)            partes.push(`Causa raíz:\n${accion.causa_raiz}`)
  if (accion.cambio_sistemico)      partes.push(`Cambio sistémico:\n${accion.cambio_sistemico}`)
  if (accion.prevencion)            partes.push(`Prevención:\n${accion.prevencion}`)
  if (accion.verificacion_eficacia) partes.push(`Verificación de eficacia:\n${accion.verificacion_eficacia}`)
  if (accion.respuesta_organizacion) partes.push(`Respuesta de la organización:\n${accion.respuesta_organizacion}`)
  if (accion.comentario_accion)     partes.push(`Comentario:\n${accion.comentario_accion}`)
  return partes.join('\n\n')
}

export function AuditorModoAzzule() {
  const { auditoriaId } = useParams<{ auditoriaId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { orgNombre?: string; orgId?: string; instalacionId?: string; instalacionNombreNav?: string } | null
  const orgNombre = state?.orgNombre ?? ''
  const orgId = state?.orgId
  const instalacionId = state?.instalacionId
  const instalacionNombreNav = state?.instalacionNombreNav ?? ''

  const [loading, setLoading] = useState(true)
  const [loadingMsg, setLoadingMsg] = useState('Cargando hallazgos…')
  const [items, setItems] = useState<AzzuleItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [marcando, setMarcando] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!auditoriaId) return
    loadItems()
  }, [auditoriaId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadItems() {
    setLoading(true)
    try {
      setLoadingMsg('Cargando hallazgos…')
      const { data: hallazgos, error: hErr } = await tbl('aud_hallazgos')
        .select('*')
        .eq('auditoria_id', auditoriaId)
      if (hErr) throw hErr
      if (!hallazgos?.length) { setItems([]); return }

      setLoadingMsg('Cargando acciones correctivas…')
      const { data: acciones, error: aErr } = await tbl('aud_acciones_correctivas')
        .select('*')
        .in('hallazgo_id', (hallazgos as AudHallazgo[]).map(h => h.id))
      if (aErr) throw aErr
      if (!acciones?.length) { setItems([]); return }

      setLoadingMsg('Validando para Azzule…')
      const validaciones = await Promise.all(
        (acciones as AudAccionCorrectivaCAPA[]).map(ac =>
          supabase.rpc('aud_lista_para_azzule', { p_accion_id: ac.id })
        )
      )

      const readyItems: AzzuleItem[] = []
      ;(acciones as AudAccionCorrectivaCAPA[]).forEach((ac, i) => {
        const vData = validaciones[i]?.data as { ready: boolean } | null
        if (vData?.ready) {
          const hallazgo = (hallazgos as AudHallazgo[]).find(h => h.id === ac.hallazgo_id)
          if (hallazgo) {
            const yaEnviada = ac.external_status === 'SUBMITTED'
              || ac.external_status === 'UNDER_REVIEW'
              || ac.external_status === 'ACCEPTED'
              || ac.external_status === 'REVIEWED'
              || ac.external_status === 'CLOSED'
            readyItems.push({ hallazgo, accion: ac, marcada: yaEnviada })
          }
        }
      })

      setItems(readyItems)
    } catch (e) {
      console.error('[AuditorModoAzzule] loadItems', e)
      toast.error('No se pudieron cargar los datos. Reintenta.')
    } finally {
      setLoading(false)
    }
  }

  async function handleMarcarCargada() {
    const item = items[currentIndex]
    if (!item) return
    setMarcando(true)
    try {
      const { error } = await supabase.rpc('aud_azzule_marcar_cargada', {
        p_accion_id: item.accion.id,
        p_source_note: 'Cargada manualmente en Azzule',
      })
      if (error) {
        console.error('[AuditorModoAzzule] marcarCargada', error)
        toast.error('No se pudo marcar como cargada. Reintenta.')
        return
      }
      setItems(prev => prev.map((it, idx) =>
        idx === currentIndex ? { ...it, marcada: true } : it
      ))
      toast.success('Marcada como enviada. Verifica la aceptación en Azzule Systems.')
    } finally {
      setMarcando(false)
    }
  }

  async function handleCopiar() {
    const item = items[currentIndex]
    if (!item) return
    const texto = buildRespuestaText(item.accion)
    if (!texto.trim()) { toast.info('No hay texto de respuesta para copiar'); return }
    try {
      await navigator.clipboard.writeText(texto)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      toast.success('Texto copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar. Copia el texto manualmente.')
    }
  }

  function handleSiguiente() {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(i => i + 1)
      setCopied(false)
    }
  }

  const backState = instalacionId
    ? { instalacionNombre: instalacionNombreNav }
    : { orgNombre }

  const current = items[currentIndex]

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(`/auditor/auditoria/${auditoriaId}`, { state: backState })}
            className="text-muted-foreground flex-shrink-0"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Modo Azzule</p>
            {orgNombre && (
              <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{orgNombre}</p>
            )}
          </div>
          {!loading && items.length > 0 && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
            >
              {currentIndex + 1} / {items.length}
            </span>
          )}
        </div>
        <div className="px-4 pb-2.5">
          <p className="text-[10px] italic" style={{ color: 'var(--muted-foreground)' }}>
            M.A.D.Y organiza, valida y da seguimiento. No sustituye a PrimusGFS, Azzule Systems, al auditor autorizado ni al organismo de certificación.
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader size={20} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{loadingMsg}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <CheckCircle size={32} style={{ color: 'var(--agro-success-text)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              No hay acciones listas para Azzule en este momento.
            </p>
            <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
              Completa los campos requeridos en cada acción y válida antes de continuar.
            </p>
            <button
              onClick={() => navigate(`/auditor/auditoria/${auditoriaId}`, { state: backState })}
              className="mt-2 h-10 px-6 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
            >
              Volver a la auditoría
            </button>
          </div>
        ) : current ? (
          <>
            {/* NC header */}
            <div className="rounded-xl px-4 py-3 flex flex-col gap-2" style={{ backgroundColor: 'var(--muted)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                  NC {currentIndex + 1} de {items.length}
                </span>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: current.hallazgo.clasificacion === 'critico' || current.hallazgo.clasificacion === 'mayor'
                      ? 'var(--agro-danger-fill)' : 'var(--muted)',
                    color: current.hallazgo.clasificacion === 'critico' || current.hallazgo.clasificacion === 'mayor'
                      ? 'var(--agro-danger-text)' : 'var(--muted-foreground)',
                  }}
                >
                  {CLASIFICACION_LABEL[current.hallazgo.clasificacion]}
                </span>
              </div>
              <p className="text-sm font-medium leading-snug" style={{ color: 'var(--foreground)' }}>
                {current.hallazgo.descripcion}
              </p>
              {current.marcada && (
                <div className="flex items-center gap-1">
                  <CheckCircle size={11} style={{ color: 'var(--agro-success-text)' }} />
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--agro-success-text)' }}>
                    Enviada — verifica aceptación en Azzule Systems
                  </span>
                </div>
              )}
            </div>

            {/* Respuesta lista */}
            <div className="rounded-xl border border-border overflow-hidden" style={{ backgroundColor: 'var(--card)' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Respuesta lista</span>
                <button
                  onClick={handleCopiar}
                  className="flex items-center gap-1.5 text-[10px] font-semibold h-7 px-2.5 rounded-lg transition-colors"
                  style={copied
                    ? { backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }
                    : { backgroundColor: 'var(--primary)', color: '#fff' }
                  }
                >
                  {copied
                    ? <><CheckCircle size={11} />Copiado</>
                    : <><Copy size={11} />Copiar</>
                  }
                </button>
              </div>
              <div className="px-4 py-3">
                {(() => {
                  const texto = buildRespuestaText(current.accion)
                  return texto.trim() ? (
                    <pre
                      className="text-[11px] whitespace-pre-wrap leading-relaxed"
                      style={{ color: 'var(--foreground)', fontFamily: 'inherit' }}
                    >
                      {texto}
                    </pre>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      Sin respuesta registrada en esta acción.
                    </p>
                  )
                })()}
              </div>
            </div>

            {/* Evidencias */}
            <div className="rounded-xl border border-border overflow-hidden" style={{ backgroundColor: 'var(--card)' }}>
              <div className="px-4 py-3 border-b border-border">
                <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Evidencias</span>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                  Evidencias — disponible con el módulo de evidencias.
                </p>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-col gap-2.5 mt-2">
              <button
                onClick={handleMarcarCargada}
                disabled={marcando || current.marcada}
                className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                style={current.marcada
                  ? { backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }
                  : { backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }
                }
              >
                {marcando
                  ? <><Loader size={15} className="animate-spin" />Marcando…</>
                  : current.marcada
                    ? <><CheckCircle size={15} />Cargada en Azzule</>
                    : 'Marcar como cargada'
                }
              </button>

              {currentIndex < items.length - 1 ? (
                <button
                  onClick={handleSiguiente}
                  className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                >
                  Siguiente <ArrowRight size={15} />
                </button>
              ) : (
                <button
                  onClick={() => navigate(`/auditor/auditoria/${auditoriaId}`, { state: backState })}
                  className="w-full h-11 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                >
                  Finalizar Modo Azzule
                </button>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  )
}
