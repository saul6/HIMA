import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation, Navigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { hoyMX } from '@/lib/fecha'
import { ModulosSelectorStep } from './ModulosSelectorStep'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

interface RanchoItem { id: string; nombre: string }
interface ModuloItem { id: string; nombre: string; orden: number }

export function AuditorNuevaAuditoria() {
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuthContext()

  const orgNombre: string = (location.state as { orgNombre?: string } | null)?.orgNombre ?? 'Empresa'
  const hoy = hoyMX()

  const [ranchos, setRanchos]                     = useState<RanchoItem[]>([])
  const [modulos, setModulos]                     = useState<ModuloItem[]>([])
  const [versionId, setVersionId]                 = useState<string | null>(null)
  const [certificadoraOrgId, setCertificadoraOrgId] = useState<string | null>(null)
  const [cargando, setCargando]                   = useState(true)

  const [ranchoId, setRanchoId]               = useState('')
  const [fecha, setFecha]                     = useState(hoy)
  const [tipoOperacion, setTipoOperacion]     = useState('')
  const [producto, setProducto]               = useState('')
  const [periodo, setPeriodo]                 = useState('')
  const [modulosSel, setModulosSel]           = useState<Set<string>>(new Set())
  const [guardando, setGuardando]             = useState(false)

  if (profile !== null && profile.rol !== 'auditor' && profile.rol !== 'super_admin') {
    return <Navigate to="/" replace />
  }

  useEffect(() => {
    if (!orgId || !profile?.id) return
    let cancelado = false
    async function init() {
      setCargando(true)
      try {
        const [rRes, verRes, asigRes] = await Promise.all([
          tbl('ranchos').select('id, nombre').eq('org_id', orgId).order('nombre'),
          tbl('aud_versiones_norma').select('id').eq('vigente', true).single(),
          tbl('auditor_asignaciones')
            .select('certificadora_org_id')
            .eq('auditor_profile_id', profile!.id)
            .eq('productor_org_id', orgId)
            .eq('activo', true)
            .maybeSingle(),
        ])
        if (cancelado) return
        setRanchos(rRes.data ?? [])
        if (verRes.error) throw verRes.error
        const vid = verRes.data.id as string
        setVersionId(vid)
        setCertificadoraOrgId(asigRes.data?.certificadora_org_id ?? profile!.org_id ?? null)

        const { data: modData, error: modErr } = await tbl('aud_modulos_norma')
          .select('id, nombre, orden')
          .eq('version_id', vid)
          .order('orden')
        if (modErr) throw modErr
        if (!cancelado) setModulos(modData ?? [])
      } catch (e) {
        if (!cancelado) toast.error('Error al cargar datos del catálogo')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    init()
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, profile?.id])

  function toggleModulo(id: string) {
    setModulosSel(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleCrear() {
    if (!ranchoId) { toast.warning('Selecciona una instalación'); return }
    if (modulosSel.size === 0) { toast.warning('Selecciona al menos un módulo PrimusGFS'); return }
    if (!versionId) { toast.warning('Catálogo no disponible, espera un momento'); return }
    if (!orgId) return

    setGuardando(true)
    try {
      const { data: audData, error: audErr } = await tbl('aud_auditorias')
        .insert({
          org_id: orgId,
          version_id: versionId,
          rancho_id: ranchoId,
          tipo_operacion: tipoOperacion.trim() || null,
          producto: producto.trim() || null,
          periodo: periodo.trim() || null,
          fecha,
          auditor_nombre: profile!.nombre_completo ?? null,
          auditor_profile_id: profile!.id,
          certificadora_org_id: certificadoraOrgId,
          creado_por: profile!.id,
          estado: 'en_proceso',
          scoring_isolation_key: crypto.randomUUID(),
        })
        .select('id')
        .single()
      if (audErr) throw audErr
      const auditoriaId = (audData as { id: string }).id

      const modInserts = Array.from(modulosSel).map(mid => ({
        org_id: orgId,
        auditoria_id: auditoriaId,
        modulo_norma_id: mid,
        aplicable: true,
      }))
      const { error: mErr } = await tbl('aud_auditoria_modulos').insert(modInserts)
      if (mErr) throw mErr

      toast.success('Auditoría creada')
      navigate(`/auditor/auditoria/${auditoriaId}`, { replace: true, state: { orgId, orgNombre } })
    } catch (e: unknown) {
      console.error('[AuditorNuevaAuditoria]', e)
      toast.error('No se pudo crear la auditoría. Reintenta.')
    } finally {
      setGuardando(false)
    }
  }

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
          <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{orgNombre}</p>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 flex flex-col gap-5 max-w-lg mx-auto w-full pb-10">
        {cargando ? (
          <p className="text-sm text-center py-12" style={{ color: 'var(--muted-foreground)' }}>
            Cargando catálogo…
          </p>
        ) : (
          <>
            {/* Instalación */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                Instalación *
              </label>
              <select value={ranchoId} onChange={e => setRanchoId(e.target.value)} style={inputSt}>
                <option value="">Seleccionar instalación…</option>
                {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
              {ranchos.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                  No hay instalaciones registradas en esta organización.
                </p>
              )}
            </div>

            {/* Fecha */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                Fecha *
              </label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputSt} />
            </div>

            {/* Tipo de operación */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                Tipo de operación
              </label>
              <input
                type="text"
                value={tipoOperacion}
                onChange={e => setTipoOperacion(e.target.value)}
                placeholder="Ej. Granja, Empaque, Invernadero…"
                style={inputSt}
              />
            </div>

            {/* Producto */}
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

            {/* Periodo */}
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

            {/* Módulos */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                Módulos PrimusGFS a evaluar *
              </label>
              <ModulosSelectorStep
                modulos={modulos}
                seleccionados={modulosSel}
                onToggle={toggleModulo}
              />
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
