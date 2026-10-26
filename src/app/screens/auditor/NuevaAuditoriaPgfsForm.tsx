import { useState, useEffect, useId } from 'react'
import { useParams, useNavigate, useLocation, Navigate } from 'react-router'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { hoyMX } from '@/lib/fecha'
import { ModulosSelectorStep } from './ModulosSelectorStep'
import { Boton } from '@/app/components/ui-mady/Boton'
import { FormularioSkeleton } from '@/app/components/FormularioSkeleton'
import { motion } from 'motion/react'
import { useEntradaPantalla } from './motionAuditor'
import { Campo } from '@/app/components/ui-mady/Campo'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

interface RanchoItem { id: string; nombre: string }
interface ModuloItem { id: string; nombre: string; orden: number }

export function NuevaAuditoriaPgfsForm({ onClose }: { onClose: () => void }) {
  const modulosLabelId = useId()
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
  const ent = useEntradaPantalla(!cargando)

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
    <>
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Nueva auditoría PrimusGFS</h2>
          <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{orgNombre}</p>
        </div>
        <button onClick={onClose} aria-label="Cerrar"><X className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 flex flex-col gap-5">
        {cargando ? (
          <FormularioSkeleton />
        ) : (
          <motion.div className="flex flex-col gap-5" {...ent(0)}>
        {/* Instalación */}
        <Campo etiqueta="Instalación" requerido className="gap-1.5">
          {({ id }) => (
            <>
              <select id={id} value={ranchoId} onChange={e => setRanchoId(e.target.value)} style={inputSt}>
                <option value="">Seleccionar instalación…</option>
                {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
              {ranchos.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--agro-info-text)' }}>
                  No hay instalaciones registradas en esta organización.
                </p>
              )}
            </>
          )}
        </Campo>

        {/* Fecha */}
        <Campo etiqueta="Fecha" requerido className="gap-1.5">
          {({ id }) => (
            <input id={id} type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputSt} />
          )}
        </Campo>

        {/* Tipo de operación */}
        <Campo etiqueta="Tipo de operación" className="gap-1.5">
          {({ id }) => (
            <input id={id}
              type="text"
              value={tipoOperacion}
              onChange={e => setTipoOperacion(e.target.value)}
              placeholder="Ej. Granja, Empaque, Invernadero…"
              style={inputSt}
            />
          )}
        </Campo>

        {/* Producto */}
        <Campo etiqueta="Producto" className="gap-1.5">
          {({ id }) => (
            <input id={id}
              type="text"
              value={producto}
              onChange={e => setProducto(e.target.value)}
              placeholder="Ej. Tomate, Zarzamora…"
              style={inputSt}
            />
          )}
        </Campo>

        {/* Periodo */}
        <Campo etiqueta="Periodo" className="gap-1.5">
          {({ id }) => (
            <input id={id}
              type="text"
              value={periodo}
              onChange={e => setPeriodo(e.target.value)}
              placeholder="Ej. Temporada 2026"
              style={inputSt}
            />
          )}
        </Campo>

        {/* Módulos */}
        <div role="group" aria-labelledby={modulosLabelId} className="flex flex-col gap-2">
          <span id={modulosLabelId} className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
            Módulos PrimusGFS a evaluar <span aria-hidden="true">*</span><span className="sr-only"> obligatorio</span>
          </span>
          <ModulosSelectorStep
            modulos={modulos}
            seleccionados={modulosSel}
            onToggle={toggleModulo}
          />
        </div>

          </motion.div>
        )}
      </div>

      {!cargando && (
        <div className="px-4 pt-3 pb-4 border-t border-border flex-shrink-0">
          <Boton onClick={handleCrear} cargando={guardando} className="w-full">
            {guardando ? 'Creando…' : 'Crear auditoría'}
          </Boton>
        </div>
      )}
    </>
  )
}
