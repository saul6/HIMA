import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useAuditoriasPGFS } from '@/hooks/useAuditoriasPGFS'
import { useRanchosOrg } from '@/hooks/useRanchosOrg'
import { hoyMX } from '@/lib/fecha'

const ROLES_PERMITIDOS = ['auditor', 'admin_org', 'super_admin']

export function NuevaAuditoriaPGFS() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()
  const { modulos, loadingModulos, crearAuditoria, versionId } = useAuditoriasPGFS()
  const { ranchos, loading: loadingRanchos } = useRanchosOrg()

  const esSuperAdmin = profile?.rol === 'super_admin'
  const hoy = hoyMX()

  const [moduloId, setModuloId]     = useState('')
  const [ranchoId, setRanchoId]     = useState('')
  const [fecha, setFecha]           = useState(hoy)
  const [auditorNombre, setAuditorNombre] = useState(profile?.nombre_completo ?? '')
  const [guardando, setGuardando]   = useState(false)

  if (!ROLES_PERMITIDOS.includes(profile?.rol ?? '')) {
    return <Navigate to="/" replace />
  }

  const inputStyle = {
    width: '100%',
    height: '2.5rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--input-background)',
    color: 'var(--foreground)',
    padding: '0 0.75rem',
    fontSize: '0.875rem',
    outline: 'none',
  } as const

  async function handleCrear() {
    if (!moduloId) { toast.warning('Selecciona un módulo PrimusGFS'); return }
    if (!ranchoId) { toast.warning('Selecciona una instalación'); return }
    if (!auditorNombre.trim()) { toast.warning('Ingresa el nombre del auditor'); return }
    if (!versionId) { toast.warning('Catálogo no disponible, espera un momento'); return }

    setGuardando(true)
    try {
      const id = await crearAuditoria({
        modulo_norma_id: moduloId,
        rancho_id: ranchoId,
        fecha,
        auditor_nombre: auditorNombre.trim(),
      })
      toast.success('Auditoría creada')
      navigate(`/inocuidad/auditorias-primusgfs/${id}`, { replace: true })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al crear auditoría')
    } finally {
      setGuardando(false)
    }
  }

  const cargando = loadingModulos || loadingRanchos

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b border-border flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-base font-semibold flex-1" style={{ color: 'var(--foreground)' }}>
          Nueva auditoría PrimusGFS
        </h1>
      </header>

      <main className="flex-1 px-4 py-6 flex flex-col gap-5 max-w-lg mx-auto w-full">
        {cargando ? (
          <p className="text-sm text-center py-12" style={{ color: 'var(--muted-foreground)' }}>
            Cargando catálogo…
          </p>
        ) : (
          <>
            {/* Módulo */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                Módulo PrimusGFS *
              </label>
              <select
                value={moduloId}
                onChange={(e) => setModuloId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Seleccionar módulo…</option>
                {modulos.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </div>

            {/* Instalación */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                Instalación *
              </label>
              <select
                value={ranchoId}
                onChange={(e) => setRanchoId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Seleccionar instalación…</option>
                {ranchos.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
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
              <input
                type="date"
                value={fecha}
                min={esSuperAdmin ? undefined : hoy}
                max={esSuperAdmin ? undefined : hoy}
                onChange={(e) => { if (esSuperAdmin) setFecha(e.target.value) }}
                style={inputStyle}
              />
            </div>

            {/* Auditor */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                Nombre del auditor *
              </label>
              <input
                type="text"
                value={auditorNombre}
                onChange={(e) => setAuditorNombre(e.target.value)}
                placeholder="Nombre completo del auditor"
                style={inputStyle}
              />
            </div>

            {/* Botón crear */}
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
