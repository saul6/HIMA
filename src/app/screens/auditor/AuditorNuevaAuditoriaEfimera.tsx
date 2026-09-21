import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation, Navigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { hoyMX } from '@/lib/fecha'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

interface ModuloItem { id: string; nombre: string; orden: number }

const inputSt: React.CSSProperties = {
  width: '100%', height: '2.5rem',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--input-background)',
  color: 'var(--foreground)',
  padding: '0 0.75rem',
  fontSize: '0.875rem',
  outline: 'none',
}

export function AuditorNuevaAuditoriaEfimera() {
  const { instalacionId } = useParams<{ instalacionId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuthContext()

  const instalacionNombre: string =
    (location.state as { instalacionNombre?: string } | null)?.instalacionNombre ?? 'Instalación'
  const hoy = hoyMX()

  const [modulos, setModulos] = useState<ModuloItem[]>([])
  const [versionId, setVersionId] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  const [fecha, setFecha] = useState(hoy)
  const [tipoOperacion, setTipoOperacion] = useState('')
  const [producto, setProducto] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [modulosSel, setModulosSel] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)

  if (profile !== null && profile.rol !== 'auditor' && profile.rol !== 'super_admin') {
    return <Navigate to="/" replace />
  }

  useEffect(() => {
    if (!profile?.id) return
    let cancelado = false
    async function init() {
      setCargando(true)
      try {
        const { data: verData, error: verErr } = await tbl('aud_versiones_norma')
          .select('id').eq('vigente', true).single()
        if (verErr) throw verErr
        const vid = verData.id as string
        if (!cancelado) setVersionId(vid)

        const { data: modData, error: modErr } = await tbl('aud_modulos_norma')
          .select('id, nombre, orden').eq('version_id', vid).order('orden')
        if (modErr) throw modErr
        if (!cancelado) setModulos(modData ?? [])
      } catch (e) {
        console.error('[AuditorNuevaAuditoriaEfimera]', e)
        if (!cancelado) toast.error('Error al cargar el catálogo')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    init()
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  function toggleModulo(id: string) {
    setModulosSel(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleCrear() {
    if (modulosSel.size === 0) { toast.warning('Selecciona al menos un módulo PrimusGFS'); return }
    if (!versionId || !instalacionId) return
    if (!profile?.org_id) { toast.error('No se pudo identificar tu organización'); return }

    setGuardando(true)
    try {
      const { data: audData, error: audErr } = await tbl('aud_auditorias')
        .insert({
          org_id: profile.org_id,
          version_id: versionId,
          rancho_id: null,
          instalacion_id: instalacionId,
          tipo_operacion: tipoOperacion.trim() || null,
          producto: producto.trim() || null,
          periodo: periodo.trim() || null,
          fecha,
          auditor_nombre: profile.nombre_completo ?? null,
          auditor_profile_id: profile.id,
          certificadora_org_id: profile.org_id,
          creado_por: profile.id,
          estado: 'en_proceso',
          scoring_isolation_key: crypto.randomUUID(),
        })
        .select('id')
        .single()
      if (audErr) throw audErr
      const auditoriaId = (audData as { id: string }).id

      const modInserts = Array.from(modulosSel).map(mid => ({
        org_id: profile.org_id,
        auditoria_id: auditoriaId,
        modulo_norma_id: mid,
        aplicable: true,
      }))
      const { error: mErr } = await tbl('aud_auditoria_modulos').insert(modInserts)
      if (mErr) throw mErr

      toast.success('Auditoría creada')
      navigate(`/auditor/auditoria/${auditoriaId}`, {
        replace: true,
        state: { instalacionId, instalacionNombre },
      })
    } catch (e: unknown) {
      console.error('[AuditorNuevaAuditoriaEfimera]', e)
      toast.error('No se pudo crear la auditoría. Reintenta.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b border-border flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground flex-shrink-0">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            Nueva auditoría PrimusGFS
          </h1>
          <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
            {instalacionNombre}
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 flex flex-col gap-5 max-w-lg mx-auto w-full pb-10">
        {cargando ? (
          <p className="text-sm text-center py-12" style={{ color: 'var(--muted-foreground)' }}>
            Cargando catálogo…
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                Fecha *
              </label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputSt} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                Tipo de operación
              </label>
              <input
                type="text"
                value={tipoOperacion}
                onChange={e => setTipoOperacion(e.target.value)}
                placeholder="Ej. Granja, Empaque…"
                style={inputSt}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                Producto
              </label>
              <input
                type="text"
                value={producto}
                onChange={e => setProducto(e.target.value)}
                placeholder="Ej. Tomate, Zarzamora…"
                style={inputSt}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                Periodo
              </label>
              <input
                type="text"
                value={periodo}
                onChange={e => setPeriodo(e.target.value)}
                placeholder="Ej. Temporada 2026"
                style={inputSt}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                Módulos PrimusGFS a evaluar *
              </label>
              {modulos.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                  No se encontraron módulos en el catálogo.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {modulos.map(m => {
                    const sel = modulosSel.has(m.id)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleModulo(m.id)}
                        className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-all"
                        style={{
                          backgroundColor: sel ? 'var(--accent)' : 'var(--card)',
                          borderColor: sel ? 'var(--primary)' : 'var(--border)',
                        }}
                      >
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border text-[10px] font-bold transition-all"
                          style={{
                            backgroundColor: sel ? 'var(--primary)' : 'transparent',
                            borderColor: sel ? 'var(--primary)' : 'var(--muted-foreground)',
                            color: '#fff',
                          }}
                        >
                          {sel ? '✓' : ''}
                        </div>
                        <p className="text-sm flex-1" style={{ color: 'var(--foreground)', fontWeight: sel ? 600 : 400 }}>
                          {m.nombre}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <button
              onClick={handleCrear}
              disabled={guardando}
              className="w-full h-11 rounded-xl text-sm font-semibold mt-2 disabled:opacity-50"
              style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
            >
              {guardando ? 'Creando…' : 'Crear auditoría'}
            </button>
          </>
        )}
      </main>
    </div>
  )
}
