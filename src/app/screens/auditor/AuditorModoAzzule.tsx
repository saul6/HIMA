import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router'
import { Copy, CheckCircle, Loader, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { AudHallazgo, AudAccionCorrectivaCAPA, AudHallazgoClasificacion } from '@/types/database.types'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { motion } from 'motion/react'
import { useEntradaPantalla } from './motionAuditor'

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
  const [items, setItems] = useState<AzzuleItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [marcando, setMarcando] = useState(false)
  const [copied, setCopied] = useState(false)
  const ent = useEntradaPantalla(!loading && items.length > 0)

  useEffect(() => {
    if (!auditoriaId) return
    loadItems()
  }, [auditoriaId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadItems() {
    setLoading(true)
    try {
      const { data: hallazgos, error: hErr } = await tbl('aud_hallazgos')
        .select('*')
        .eq('auditoria_id', auditoriaId)
      if (hErr) throw hErr
      if (!hallazgos?.length) { setItems([]); return }

      const { data: acciones, error: aErr } = await tbl('aud_acciones_correctivas')
        .select('*')
        .in('hallazgo_id', (hallazgos as AudHallazgo[]).map(h => h.id))
      if (aErr) throw aErr
      if (!acciones?.length) { setItems([]); return }

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
      <ModuloHeader
        tituloFallback="Modo Azzule"
        subtitulo={orgNombre || undefined}
        onBack={() => navigate(`/auditor/auditoria/${auditoriaId}`, { state: backState })}
        acciones={!loading && items.length > 0 ? <Etiqueta>{currentIndex + 1} / {items.length}</Etiqueta> : undefined}
      />

      <main className="flex-1 px-4 py-4 flex flex-col gap-4">
        <p className="text-caption italic" style={{ color: 'var(--muted-foreground)' }}>
          M.A.D.Y organiza, valida y da seguimiento. No sustituye a PrimusGFS, Azzule Systems, al auditor autorizado ni al organismo de certificación.
        </p>
        {loading ? (
          <div aria-busy="true" aria-label="Cargando hallazgos">
            <ListaSkeleton rows={3} />
          </div>
        ) : items.length === 0 ? (
          <EstadoVacio
            icono={CheckCircle}
            titulo="No hay acciones listas para Azzule en este momento."
            ayuda="Completa los campos requeridos en cada acción y válida antes de continuar."
            accion={(
              <Boton variante="secundario" onClick={() => navigate(`/auditor/auditoria/${auditoriaId}`, { state: backState })}>
                Volver a la auditoría
              </Boton>
            )}
          />
        ) : current ? (
          <motion.div className="flex flex-col gap-4" {...ent(0)}>
            {/* NC header */}
            <div className="rounded-xl px-4 py-3 flex flex-col gap-2" style={{ backgroundColor: 'var(--muted)' }}>
              <div className="flex items-center justify-between">
                <span className="text-caption font-bold" style={{ color: 'var(--muted-foreground)' }}>
                  NC {currentIndex + 1} de {items.length}
                </span>
                <span
                  className="text-caption font-semibold px-1.5 py-0.5 rounded"
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
                  <span className="text-caption font-semibold" style={{ color: 'var(--agro-success-text)' }}>
                    Enviada — verifica aceptación en Azzule Systems
                  </span>
                </div>
              )}
            </div>

            {/* Respuesta lista */}
            <div className="rounded-xl border border-border overflow-hidden" style={{ backgroundColor: 'var(--card)' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Respuesta lista</span>
                <Boton
                  variante="secundario"
                  tamano="sm"
                  onClick={handleCopiar}
                  className={copied ? 'border-transparent bg-agro-success-fill text-agro-success-text hover:bg-agro-success-fill' : undefined}
                >
                  {copied
                    ? <><CheckCircle size={13} />Copiado</>
                    : <><Copy size={13} />Copiar</>
                  }
                </Boton>
              </div>
              <div className="px-4 py-3">
                {(() => {
                  const texto = buildRespuestaText(current.accion)
                  return texto.trim() ? (
                    <pre
                      className="text-caption whitespace-pre-wrap leading-relaxed"
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
                <p className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                  Evidencias — disponible con el módulo de evidencias.
                </p>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-col gap-2.5 mt-2">
              <Boton
                variante="secundario"
                onClick={handleMarcarCargada}
                disabled={marcando || current.marcada}
                className={current.marcada ? 'w-full border-transparent bg-agro-success-fill text-agro-success-text' : 'w-full'}
              >
                {marcando
                  ? <><Loader size={15} className="animate-spin motion-reduce:animate-none" />Marcando…</>
                  : current.marcada
                    ? <><CheckCircle size={15} />Cargada en Azzule</>
                    : 'Marcar como cargada'
                }
              </Boton>

              {currentIndex < items.length - 1 ? (
                <Boton onClick={handleSiguiente} className="w-full">
                  Siguiente <ArrowRight size={15} />
                </Boton>
              ) : (
                <Boton onClick={() => navigate(`/auditor/auditoria/${auditoriaId}`, { state: backState })} className="w-full">
                  Finalizar Modo Azzule
                </Boton>
              )}
            </div>
          </motion.div>
        ) : null}
      </main>
    </div>
  )
}
