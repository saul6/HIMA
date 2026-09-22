import { useState, useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router'
import { ChevronLeft, Plus, ClipboardCheck, MapPin, Info, AlertTriangle, Loader, Building2, CheckCircle2, XCircle } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { BottomSheet } from '@/app/components/BottomSheet'
import { useAuditorAsignaciones } from '@/hooks/useAuditorAsignaciones'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

interface InstalacionInfo {
  id: string
  nombre: string
  ubicacion: string | null
  cultivo_producto: string | null
  tipo_operacion: string | null
  contacto: string | null
  linked_org_id: string | null
  linked_rancho_id: string | null
  linked_at: string | null
}

interface AuditoriaItem {
  id: string
  fecha: string
  estado: string
  modulos: string[]
}

interface ProfileItem {
  id: string
  nombre_completo: string | null
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

const inputSt: React.CSSProperties = {
  width: '100%',
  height: '2.5rem',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--input-background)',
  color: 'var(--foreground)',
  padding: '0 0.75rem',
  fontSize: '0.875rem',
  outline: 'none',
}

function formatFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

export function AuditorInstalacionDetalle() {
  const { instalacionId } = useParams<{ instalacionId: string }>()
  const navigate = useNavigate()
  const { profile } = useAuthContext()
  const { orgs: orgsAsignadas } = useAuditorAsignaciones()

  const [instalacion, setInstalacion] = useState<InstalacionInfo | null>(null)
  const [linkedOrgNombre, setLinkedOrgNombre] = useState<string | null>(null)
  const [auditorias, setAuditorias] = useState<AuditoriaItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // — Sheet: vincular a org M.A.D.Y. —
  const [sheetVincular, setSheetVincular] = useState(false)
  // Org destino: 'asignada' = elegir de asignadas, 'manual' = UUID manual
  const [modoOrg, setModoOrg] = useState<'asignada' | 'manual'>('asignada')
  const [orgSelId, setOrgSelId] = useState('')
  const [orgSelNombre, setOrgSelNombre] = useState('')
  const [orgManualId, setOrgManualId] = useState('')
  // Productor
  const [perfiles, setPerfiles] = useState<ProfileItem[]>([])
  const [cargandoPerfiles, setCargandoPerfiles] = useState(false)
  const [productorId, setProductorId] = useState('')
  const [productorManualId, setProductorManualId] = useState('')
  // Opcionales
  const [ranchoCodigo, setRanchoCodigo] = useState('')
  const [ranchoCultivo, setRanchoCultivo] = useState('')
  // Confirmación
  const [confirmado, setConfirmado] = useState(false)
  const [vinculando, setVinculando] = useState(false)

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
          .select('id, nombre, ubicacion, cultivo_producto, tipo_operacion, contacto, linked_org_id, linked_rancho_id, linked_at')
          .eq('id', instalacionId)
          .single()
        if (instErr) throw instErr
        if (!cancelado) setInstalacion(instData as InstalacionInfo)

        // si ya está vinculada, obtener el nombre de la org
        if (instData?.linked_org_id) {
          const { data: orgData } = await tbl('organizaciones')
            .select('nombre')
            .eq('id', instData.linked_org_id)
            .maybeSingle()
          if (!cancelado) setLinkedOrgNombre(orgData?.nombre ?? null)
        }

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

  async function cargarPerfiles(orgId: string) {
    if (!orgId) { setPerfiles([]); return }
    setCargandoPerfiles(true)
    setPerfiles([])
    setProductorId('')
    try {
      const { data, error: pErr } = await tbl('profiles')
        .select('id, nombre_completo')
        .eq('org_id', orgId)
        .eq('activo', true)
      if (pErr) throw pErr
      setPerfiles((data ?? []) as ProfileItem[])
    } catch (e) {
      console.error('[AuditorInstalacionDetalle] cargarPerfiles', e)
      setPerfiles([])
    } finally {
      setCargandoPerfiles(false)
    }
  }

  function handleSelOrg(id: string, nombre: string) {
    setOrgSelId(id)
    setOrgSelNombre(nombre)
    setProductorId('')
    if (id) cargarPerfiles(id)
  }

  function handleAbrirVincular() {
    setModoOrg('asignada')
    setOrgSelId('')
    setOrgSelNombre('')
    setOrgManualId('')
    setPerfiles([])
    setProductorId('')
    setProductorManualId('')
    setRanchoCodigo('')
    setRanchoCultivo(instalacion?.cultivo_producto ?? '')
    setConfirmado(false)
    setSheetVincular(true)
  }

  function traducirError(err: unknown): string {
    const e = err as { message?: string; code?: string }
    const msg = e?.message ?? String(err)
    if (e?.code === '42501' || msg.toLowerCase().includes('policy') || msg.toLowerCase().includes('permission')) {
      return 'Sin permiso para realizar esta operación.'
    }
    if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network')) {
      return 'Sin conexión. Reintenta.'
    }
    return 'No se pudo vincular la instalación. Reintenta.'
  }

  async function handleVincular() {
    const targetOrgId = modoOrg === 'asignada' ? orgSelId : orgManualId.trim()
    const targetProductorId = perfiles.length > 0 ? productorId : productorManualId.trim()

    if (!targetOrgId) { toast.warning('Selecciona o ingresa la organización destino.'); return }
    if (!targetProductorId) { toast.warning('Selecciona o ingresa el productor responsable.'); return }
    if (!confirmado) { toast.warning('Confirma que entiendes que esta acción es permanente.'); return }
    if (!instalacionId) return

    setVinculando(true)
    try {
      const { data: ranchoId, error: rpcErr } = await (supabase as any).rpc('aud_vincular_instalacion_a_org', {
        p_instalacion_id: instalacionId,
        p_target_org_id: targetOrgId,
        p_productor_id: targetProductorId,
        p_rancho_codigo: ranchoCodigo.trim() || null,
        p_rancho_cultivo: ranchoCultivo.trim() || null,
      })
      if (rpcErr) {
        console.error('[AuditorInstalacionDetalle] aud_vincular_instalacion_a_org', rpcErr)
        toast.error(traducirError(rpcErr))
        return
      }
      console.log('[AuditorInstalacionDetalle] vinculado, rancho_id:', ranchoId)

      const orgNombreFinal = modoOrg === 'asignada' ? orgSelNombre : targetOrgId
      setInstalacion(prev => prev ? {
        ...prev,
        linked_org_id: targetOrgId,
        linked_rancho_id: typeof ranchoId === 'string' ? ranchoId : null,
        linked_at: new Date().toISOString(),
      } : prev)
      setLinkedOrgNombre(orgNombreFinal)
      setSheetVincular(false)
      toast.success('Instalación vinculada a M.A.D.Y. El expediente se transfirió correctamente.')
    } catch (e) {
      console.error('[AuditorInstalacionDetalle] handleVincular', e)
      toast.error(traducirError(e))
    } finally {
      setVinculando(false)
    }
  }

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
            {instalacion?.linked_org_id
              ? `Vinculada a M.A.D.Y.${linkedOrgNombre ? ` · ${linkedOrgNombre}` : ''}`
              : 'Instalación efímera'
            }
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

          {/* Banner: ya vinculada */}
          {instalacion?.linked_org_id && (
            <section
              className="rounded-xl px-4 py-3 flex items-start gap-3"
              style={{ backgroundColor: 'var(--agro-success-fill)', borderLeft: '3px solid var(--agro-success-text)' }}
            >
              <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-success-text)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: 'var(--agro-success-text)' }}>
                  Vinculada a M.A.D.Y.{linkedOrgNombre ? ` · ${linkedOrgNombre}` : ''}
                </p>
                {instalacion.linked_at && (
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--agro-success-text)' }}>
                    Desde {new Date(instalacion.linked_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                )}
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--agro-success-text)' }}>
                  El expediente pertenece a la organización productora. Las auditorías siguen accesibles por tu asignación.
                </p>
              </div>
            </section>
          )}

          {/* Botón: vincular */}
          {instalacion && !instalacion.linked_org_id && (
            <button
              onClick={handleAbrirVincular}
              className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1.5px solid var(--border)' }}
            >
              <Building2 size={16} />
              Vincular a organización M.A.D.Y.
            </button>
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
      {!instalacion?.linked_org_id && (
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
      )}

      {/* Sheet: Vincular a organización M.A.D.Y. */}
      <BottomSheet open={sheetVincular} onClose={() => setSheetVincular(false)} height="85%">
        <div className="flex flex-col h-full">
          {/* Cabecera */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                Vincular a M.A.D.Y.
              </h2>
              <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: 'var(--muted-foreground)' }}>
                {instalacion?.nombre}
              </p>
            </div>
            <button onClick={() => setSheetVincular(false)} className="text-muted-foreground ml-2 flex-shrink-0">
              <XCircle size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
            {/* Aviso de acción permanente */}
            <div
              className="rounded-xl px-4 py-3 flex items-start gap-3"
              style={{ backgroundColor: 'var(--agro-danger-fill)', borderLeft: '3px solid var(--agro-red)' }}
            >
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: 'var(--agro-danger-text)' }}>
                  Acción permanente e irreversible
                </p>
                <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: 'var(--agro-danger-text)' }}>
                  El expediente completo (auditorías, NC, acciones correctivas, evidencias y snapshots) se transfiere a la organización productora destino. No se crea un sitio duplicado. Esta acción no puede deshacerse desde el front.
                </p>
              </div>
            </div>

            {/* Org destino */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                Organización destino <span style={{ color: 'var(--agro-red)' }}>*</span>
              </p>

              {/* Selector modo */}
              <div className="flex rounded-lg overflow-hidden border border-border">
                {(['asignada', 'manual'] as const).map(modo => (
                  <button
                    key={modo}
                    onClick={() => {
                      setModoOrg(modo)
                      setOrgSelId('')
                      setOrgSelNombre('')
                      setOrgManualId('')
                      setPerfiles([])
                      setProductorId('')
                    }}
                    className="flex-1 py-2 text-xs font-semibold transition-colors"
                    style={modoOrg === modo
                      ? { backgroundColor: 'var(--primary)', color: '#fff' }
                      : { backgroundColor: 'var(--card)', color: 'var(--muted-foreground)' }
                    }
                  >
                    {modo === 'asignada' ? 'Mis organizaciones' : 'Ingresar ID'}
                  </button>
                ))}
              </div>

              {modoOrg === 'asignada' ? (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                    Selecciona la organización
                  </label>
                  <select
                    value={orgSelId}
                    onChange={e => {
                      const id = e.target.value
                      const org = orgsAsignadas.find(o => o.org_id === id)
                      handleSelOrg(id, org?.nombre ?? '')
                    }}
                    style={{ ...inputSt, height: '2.5rem' }}
                  >
                    <option value="">— Elige una organización —</option>
                    {orgsAsignadas.map(o => (
                      <option key={o.org_id} value={o.org_id}>{o.nombre}</option>
                    ))}
                  </select>
                  {orgsAsignadas.length === 0 && (
                    <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                      No tienes organizaciones asignadas. Usa "Ingresar ID" si ya tienes el UUID de la org.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                    ID de organización (UUID)
                  </label>
                  <input
                    type="text"
                    value={orgManualId}
                    onChange={e => setOrgManualId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    style={inputSt}
                  />
                  <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                    El admin de la organización puede obtenerlo en Ajustes de su cuenta.
                  </p>
                  {orgManualId.trim().length > 10 && (
                    <button
                      onClick={() => cargarPerfiles(orgManualId.trim())}
                      disabled={cargandoPerfiles}
                      className="self-start text-[10px] font-semibold h-7 px-3 rounded-lg disabled:opacity-50 flex items-center gap-1"
                      style={{ backgroundColor: 'var(--muted)', color: 'var(--primary)', border: '1px solid var(--border)' }}
                    >
                      {cargandoPerfiles ? <Loader size={10} className="animate-spin" /> : null}
                      Cargar usuarios de esta org
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Productor destino */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                Productor responsable <span style={{ color: 'var(--agro-red)' }}>*</span>
              </p>
              {cargandoPerfiles ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader size={13} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Cargando usuarios…</span>
                </div>
              ) : perfiles.length > 0 ? (
                <select
                  value={productorId}
                  onChange={e => setProductorId(e.target.value)}
                  style={{ ...inputSt, height: '2.5rem' }}
                >
                  <option value="">— Selecciona un usuario —</option>
                  {perfiles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre_completo ?? p.id}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                    ID de perfil (UUID) del productor
                  </label>
                  <input
                    type="text"
                    value={productorManualId}
                    onChange={e => setProductorManualId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    style={inputSt}
                  />
                  <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                    El productor puede consultar su ID de perfil en Ajustes de M.A.D.Y.
                  </p>
                </div>
              )}
            </div>

            {/* Campos opcionales */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                Opcionales (para el rancho que se creará)
              </p>
              <div className="flex flex-col gap-1">
                <label className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Código de rancho</label>
                <input
                  type="text"
                  value={ranchoCodigo}
                  onChange={e => setRanchoCodigo(e.target.value)}
                  placeholder="Ej. EXT-001 (se genera automáticamente si se deja vacío)"
                  style={inputSt}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Cultivo / Producto</label>
                <input
                  type="text"
                  value={ranchoCultivo}
                  onChange={e => setRanchoCultivo(e.target.value)}
                  placeholder={instalacion?.cultivo_producto ?? 'Ej. Tomate, Zarzamora…'}
                  style={inputSt}
                />
              </div>
            </div>

            {/* Confirmación */}
            <label
              className="flex items-start gap-3 rounded-xl p-3 cursor-pointer"
              style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}
            >
              <input
                type="checkbox"
                checked={confirmado}
                onChange={e => setConfirmado(e.target.checked)}
                className="mt-0.5 flex-shrink-0 w-4 h-4"
                style={{ accentColor: 'var(--primary)' }}
              />
              <span className="text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>
                Entiendo que esta acción es <strong>permanente e irreversible</strong>. El expediente se transfiere a la organización productora destino y no puede deshacerse desde esta pantalla.
              </span>
            </label>
          </div>

          {/* Botón vincular */}
          <div className="px-4 pb-6 pt-3 flex-shrink-0 border-t border-border">
            <button
              onClick={handleVincular}
              disabled={vinculando || !confirmado}
              className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
            >
              {vinculando
                ? <><Loader size={15} className="animate-spin" /> Vinculando…</>
                : <><Building2 size={15} /> Vincular expediente a M.A.D.Y.</>
              }
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
