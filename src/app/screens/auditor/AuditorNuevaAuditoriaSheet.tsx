import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { hoyMX } from '@/lib/fecha'
import { ModulosSelectorStep } from './ModulosSelectorStep'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

interface ModuloItem { id: string; nombre: string; orden: number }

interface Props {
  onClose: () => void
  onCreated: () => void
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

export function AuditorNuevaAuditoriaSheet({ onClose, onCreated }: Props) {
  const { profile } = useAuthContext()
  const navigate = useNavigate()

  const [paso, setPaso] = useState<1 | 2>(1)

  // Paso 1 — instalación
  const [nombre, setNombre] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [cultivoProducto, setCultivoProducto] = useState('')
  const [tipoOperacion, setTipoOperacion] = useState('')
  const [contacto, setContacto] = useState('')

  // Paso 2 — módulos
  const [modulos, setModulos] = useState<ModuloItem[]>([])
  const [versionId, setVersionId] = useState<string | null>(null)
  const [cargandoModulos, setCargandoModulos] = useState(false)
  const [modulosSel, setModulosSel] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)

  async function handleSiguiente() {
    if (!nombre.trim()) { toast.warning('Escribe el nombre de la instalación'); return }
    if (modulos.length === 0 && !cargandoModulos) {
      setCargandoModulos(true)
      try {
        const { data: verData, error: verErr } = await tbl('aud_versiones_norma')
          .select('id').eq('vigente', true).single()
        if (verErr) throw verErr
        const vid = verData.id as string
        setVersionId(vid)
        const { data: modData, error: modErr } = await tbl('aud_modulos_norma')
          .select('id, nombre, orden').eq('version_id', vid).order('orden')
        if (modErr) throw modErr
        setModulos(modData ?? [])
      } catch (e) {
        console.error('[AuditorNuevaAuditoriaSheet]', e)
        toast.error('Error al cargar el catálogo de módulos')
        setCargandoModulos(false)
        return
      }
      setCargandoModulos(false)
    }
    setPaso(2)
  }

  function toggleModulo(id: string) {
    setModulosSel(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleCrear() {
    if (modulosSel.size === 0) { toast.warning('Selecciona al menos un módulo'); return }
    if (!versionId || !profile?.org_id) return

    setGuardando(true)
    let instId: string | null = null
    try {
      // 1) instalación (dueño = auditor)
      const { data: instData, error: e1 } = await tbl('aud_instalaciones').insert({
        auditor_profile_id: profile.id,
        certificadora_org_id: profile.org_id,
        nombre: nombre.trim(),
        ubicacion: ubicacion.trim() || null,
        cultivo_producto: cultivoProducto.trim() || null,
        tipo_operacion: tipoOperacion.trim() || null,
        contacto: contacto.trim() || null,
      }).select('id').single()
      if (e1) throw e1
      instId = (instData as { id: string }).id

      // 2) auditoría (org_id = certificadora del auditor)
      const { data: audData, error: e2 } = await tbl('aud_auditorias').insert({
        org_id: profile.org_id,
        version_id: versionId,
        instalacion_id: instId,
        rancho_id: null,
        auditor_profile_id: profile.id,
        certificadora_org_id: profile.org_id,
        auditor_nombre: profile.nombre_completo ?? null,
        fecha: hoyMX(),
        estado: 'en_proceso',
        creado_por: profile.id,
        scoring_isolation_key: crypto.randomUUID(),
      }).select('id').single()
      if (e2) {
        // evita instalación huérfana
        await tbl('aud_instalaciones').delete().eq('id', instId)
        throw e2
      }
      const auditoriaId = (audData as { id: string }).id

      // 3) módulos elegidos
      const filas = Array.from(modulosSel).map(mid => ({
        org_id: profile.org_id,
        auditoria_id: auditoriaId,
        modulo_norma_id: mid,
        aplicable: true,
      }))
      const { error: e3 } = await tbl('aud_auditoria_modulos').insert(filas)
      if (e3) throw e3

      onCreated()
      navigate(`/auditor/auditoria/${auditoriaId}`, {
        state: { instalacionId: instId, instalacionNombre: nombre.trim() },
      })
    } catch (e) {
      console.error('[AuditorNuevaAuditoriaSheet]', e)
      toast.error('No se pudo crear la auditoría. Reintenta.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      {/* Fondo */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
        style={{
          backgroundColor: 'var(--card)',
          borderRadius: '0.625rem 0.625rem 0 0',
          maxHeight: '85vh',
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>

        {/* Cabecera */}
        <div className="flex items-center gap-3 px-4 pb-3 flex-shrink-0 border-b border-border">
          {paso === 2 ? (
            <button onClick={() => setPaso(1)} className="flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
              <ChevronLeft size={22} />
            </button>
          ) : (
            <button onClick={onClose} className="flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
              <X size={20} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              Nueva auditoría
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {paso === 1 ? 'Paso 1 de 2 · Instalación a auditar' : 'Paso 2 de 2 · Módulos a evaluar'}
            </p>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 flex flex-col gap-4" style={{ paddingBottom: '2rem' }}>
          {paso === 1 ? (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                  Nombre *
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Nombre de la instalación"
                  style={inputSt}
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                  Ubicación
                </label>
                <input
                  type="text"
                  value={ubicacion}
                  onChange={e => setUbicacion(e.target.value)}
                  placeholder="Ciudad, estado o dirección"
                  style={inputSt}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                  Cultivo / Producto
                </label>
                <input
                  type="text"
                  value={cultivoProducto}
                  onChange={e => setCultivoProducto(e.target.value)}
                  placeholder="Ej. Tomate, Zarzamora…"
                  style={inputSt}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                  Tipo de operación
                </label>
                <input
                  type="text"
                  value={tipoOperacion}
                  onChange={e => setTipoOperacion(e.target.value)}
                  placeholder="Granja · Invernadero · Empaque · Cuarto Frío…"
                  style={inputSt}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                  Contacto (opcional)
                </label>
                <input
                  type="text"
                  value={contacto}
                  onChange={e => setContacto(e.target.value)}
                  placeholder="Nombre o teléfono del responsable"
                  style={inputSt}
                />
              </div>

              <button
                onClick={handleSiguiente}
                disabled={cargandoModulos}
                className="w-full h-11 rounded-xl text-sm font-semibold mt-2 disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
              >
                {cargandoModulos ? 'Cargando…' : 'Siguiente'}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Elige los módulos normativos a evaluar (mínimo 1).
              </p>

              {cargandoModulos ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--muted-foreground)' }}>
                  Cargando catálogo…
                </p>
              ) : (
                <ModulosSelectorStep
                  modulos={modulos}
                  seleccionados={modulosSel}
                  onToggle={toggleModulo}
                />
              )}

              <button
                onClick={handleCrear}
                disabled={guardando || cargandoModulos}
                className="w-full h-11 rounded-xl text-sm font-semibold mt-2 disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
              >
                {guardando ? 'Creando…' : 'Crear auditoría'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
