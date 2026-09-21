import { useState, useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router'
import { ChevronLeft, Plus, ClipboardCheck, MapPin, Info } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

interface InstalacionInfo {
  id: string
  nombre: string
  ubicacion: string | null
  cultivo_producto: string | null
  tipo_operacion: string | null
  contacto: string | null
}

interface AuditoriaItem {
  id: string
  fecha: string
  estado: string
  modulos: string[]
}

const ESTADO_LABELS: Record<string, string> = {
  en_proceso: 'En proceso',
  preliminar: 'Preliminar',
  cerrada:    'Cerrada',
}
const ESTADO_STYLE: Record<string, { bg: string; color: string }> = {
  en_proceso: { bg: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' },
  preliminar: { bg: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' },
  cerrada:    { bg: 'var(--muted)',              color: 'var(--muted-foreground)'  },
}

function formatFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

export function AuditorInstalacionDetalle() {
  const { instalacionId } = useParams<{ instalacionId: string }>()
  const navigate = useNavigate()
  const { profile } = useAuthContext()

  const [instalacion, setInstalacion] = useState<InstalacionInfo | null>(null)
  const [auditorias, setAuditorias] = useState<AuditoriaItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  if (profile !== null && profile.rol !== 'auditor' && profile.rol !== 'super_admin') {
    return <Navigate to="/" replace />
  }

  useEffect(() => {
    if (!instalacionId) return
    let cancelado = false
    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const { data: instData, error: instErr } = await tbl('aud_instalaciones')
          .select('id, nombre, ubicacion, cultivo_producto, tipo_operacion, contacto')
          .eq('id', instalacionId)
          .single()
        if (instErr) throw instErr
        if (!cancelado) setInstalacion(instData as InstalacionInfo)

        const { data: audData, error: audErr } = await tbl('aud_auditorias')
          .select('id, fecha, estado, aud_auditoria_modulos(aud_modulos_norma(nombre))')
          .eq('instalacion_id', instalacionId)
          .order('fecha', { ascending: false })
        if (audErr) throw audErr

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: AuditoriaItem[] = (audData ?? []).map((a: any) => ({
          id: a.id,
          fecha: a.fecha,
          estado: a.estado,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          modulos: (a.aud_auditoria_modulos ?? []).map((am: any) => am.aud_modulos_norma?.nombre ?? '').filter(Boolean),
        }))
        if (!cancelado) setAuditorias(items)
      } catch (e: unknown) {
        console.error('[AuditorInstalacionDetalle]', e)
        if (!cancelado) setError('No se pudo cargar la instalación.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instalacionId])

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-card border-b border-border flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate('/auditor')} className="text-muted-foreground flex-shrink-0">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate" style={{ color: 'var(--foreground)' }}>
            {instalacion?.nombre ?? 'Instalación'}
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Instalación efímera
          </p>
        </div>
      </header>

      {cargando ? (
        <p className="text-sm text-center py-16" style={{ color: 'var(--muted-foreground)' }}>
          Cargando…
        </p>
      ) : error ? (
        <p className="text-sm text-center py-16" style={{ color: 'var(--agro-danger-text)' }}>
          {error}
        </p>
      ) : (
        <main className="flex-1 px-4 py-4 flex flex-col gap-6">
          {/* Info de la instalación */}
          {instalacion && (instalacion.ubicacion || instalacion.tipo_operacion || instalacion.cultivo_producto || instalacion.contacto) && (
            <section className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2">
              {instalacion.ubicacion && (
                <div className="flex items-center gap-2">
                  <MapPin size={13} style={{ color: 'var(--muted-foreground)' }} className="flex-shrink-0" />
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{instalacion.ubicacion}</p>
                </div>
              )}
              {(instalacion.tipo_operacion || instalacion.cultivo_producto) && (
                <div className="flex items-center gap-2">
                  <Info size={13} style={{ color: 'var(--muted-foreground)' }} className="flex-shrink-0" />
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {[instalacion.tipo_operacion, instalacion.cultivo_producto].filter(Boolean).join(' · ')}
                  </p>
                </div>
              )}
              {instalacion.contacto && (
                <p className="text-xs pl-5" style={{ color: 'var(--muted-foreground)' }}>
                  Contacto: {instalacion.contacto}
                </p>
              )}
            </section>
          )}

          {/* Auditorías */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: 'var(--muted-foreground)' }}>
              Auditorías ({auditorias.length})
            </p>
            {auditorias.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10">
                <ClipboardCheck size={36} style={{ color: 'var(--muted-foreground)', opacity: 0.4 }} />
                <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
                  Sin auditorías registradas
                </p>
                <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
                  Usa el botón + para crear la primera
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {auditorias.map(a => {
                  const style = ESTADO_STYLE[a.estado] ?? ESTADO_STYLE.cerrada
                  return (
                    <button
                      key={a.id}
                      onClick={() => navigate(`/auditor/auditoria/${a.id}`, {
                        state: { instalacionId, instalacionNombre: instalacion?.nombre }
                      })}
                      className="w-full text-left bg-card rounded-xl border border-border p-4 flex items-start justify-between gap-2 active:opacity-70 transition-opacity"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                          {a.modulos.length > 0 ? a.modulos.join(' · ') : 'Auditoría PrimusGFS'}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          {formatFecha(a.fecha)}
                        </p>
                      </div>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: style.bg, color: style.color }}
                      >
                        {ESTADO_LABELS[a.estado] ?? a.estado}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </main>
      )}

      {/* FAB */}
      <button
        onClick={() => navigate(`/auditor/instalacion/${instalacionId}/nueva`, {
          state: { instalacionNombre: instalacion?.nombre }
        })}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-20"
        style={{ backgroundColor: 'var(--primary)' }}
        aria-label="Nueva auditoría"
      >
        <Plus size={24} color="white" />
      </button>
    </div>
  )
}
