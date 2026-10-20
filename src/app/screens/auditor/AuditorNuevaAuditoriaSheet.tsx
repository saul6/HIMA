import { useState } from 'react'
import { useNavigate } from 'react-router'
import { X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { hoyMX } from '@/lib/fecha'
import { ModulosSelectorStep } from './ModulosSelectorStep'
import { BottomSheet } from '@/app/components/BottomSheet'
import { SPRING_SUAVE } from '@/lib/motion'
import { Boton } from '@/app/components/ui-mady/Boton'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

interface ModuloItem { id: string; nombre: string; orden: number }

interface Props {
  onClose: () => void
  onCreated: () => void
}

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]
const STEP_TRANSITION = { duration: 0.22, ease: EASE_OUT }

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
  const hoy = hoyMX()

  const reducedMotion = useReducedMotion()
  const [paso, setPaso] = useState<1 | 2>(1)
  const [direccion, setDireccion] = useState<1 | -1>(1)

  // Paso 1 — instalación
  const [nombre, setNombre] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [cultivoProducto, setCultivoProducto] = useState('')
  const [tipoOperacion, setTipoOperacion] = useState('')
  const [contacto, setContacto] = useState('')
  const [fechaInicio, setFechaInicio] = useState(hoy)
  const [fechaFin, setFechaFin] = useState(hoy)

  // Paso 2 — módulos
  const [modulos, setModulos] = useState<ModuloItem[]>([])
  const [versionId, setVersionId] = useState<string | null>(null)
  const [cargandoModulos, setCargandoModulos] = useState(false)
  const [modulosSel, setModulosSel] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)

  async function handleSiguiente() {
    if (!nombre.trim()) { toast.warning('Escribe el nombre de la instalación'); return }
    if (!fechaInicio || !fechaFin) { toast.warning('Indica la(s) fecha(s) de visita'); return }
    if (fechaFin < fechaInicio) { toast.warning('La fecha de fin debe ser igual o posterior al inicio'); return }

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
    setDireccion(1)
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

      // 4) evento de agenda — rango de visita
      const { error: e4 } = await tbl('aud_agenda').insert({
        auditor_profile_id: profile.id,
        instalacion_id: instId,
        auditoria_id: auditoriaId,
        tipo: 'visita',
        titulo: nombre.trim(),
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      })
      if (e4) console.error('[AuditorNuevaAuditoriaSheet] aud_agenda', e4)

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
    <BottomSheet open onClose={onClose} height="85%">
      {/* Cabecera */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Nueva auditoría</h2>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {paso === 1 ? 'Paso 1 de 2 · Instalación a auditar' : 'Paso 2 de 2 · Módulos a evaluar'}
          </p>
        </div>
        <button onClick={onClose} aria-label="Cerrar"><X className="w-5 h-5" /></button>
      </div>

      {/* Indicador de pasos */}
      <div className="flex justify-center pt-3 flex-shrink-0">
        <div className="relative inline-flex items-center gap-2">
          <div className="absolute left-[6px] right-[6px] top-1/2 -translate-y-1/2 h-0.5 rounded-full bg-muted-foreground/20" />
          {[1, 2].map(n => {
            const active = n === paso
            return (
              <button
                key={n}
                type="button"
                onClick={() => { if (n === 1 && paso === 2) { setDireccion(-1); setPaso(1) } }}
                aria-label={`Paso ${n}`}
                aria-current={active ? 'step' : undefined}
                className={`relative z-10 h-3 w-3 rounded-full transition-colors duration-[var(--motion-fast)] ${
                  active ? '' : n < paso ? 'bg-primary/40' : 'bg-muted-foreground/30'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="auditor-nueva-auditoria-paso"
                    className="absolute -left-1.5 inset-y-0 w-6 rounded-full bg-primary"
                    transition={reducedMotion ? { duration: 0 } : SPRING_SUAVE}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4 pb-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={paso}
            className="flex flex-col gap-4"
            initial={reducedMotion ? false : { opacity: 0, x: direccion * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, x: -direccion * 24 }}
            transition={reducedMotion ? { duration: 0 } : STEP_TRANSITION}
          >
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

          {/* Rango de visita */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
              Fecha de visita *
            </label>
            <div className="flex gap-2">
              <div className="flex-1 flex flex-col gap-1">
                <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Inicio</span>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={e => {
                    setFechaInicio(e.target.value)
                    if (fechaFin < e.target.value) setFechaFin(e.target.value)
                  }}
                  style={inputSt}
                />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Fin</span>
                <input
                  type="date"
                  value={fechaFin}
                  min={fechaInicio}
                  onChange={e => setFechaFin(e.target.value)}
                  style={inputSt}
                />
              </div>
            </div>
            <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
              Si la visita es de un solo día, deja inicio y fin iguales.
            </p>
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

              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pie fijo */}
      <div className="px-4 pt-3 pb-4 border-t border-border flex-shrink-0">
        {paso === 1 ? (
          <Boton onClick={handleSiguiente} disabled={cargandoModulos} className="w-full">
            {cargandoModulos ? 'Cargando…' : 'Siguiente'}
          </Boton>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => { setDireccion(-1); setPaso(1) }}
              className="h-11 px-4 rounded-xl text-sm font-semibold border border-border"
              style={{ color: 'var(--foreground)' }}
            >
              Atrás
            </button>
            <Boton onClick={handleCrear} disabled={guardando || cargandoModulos} className="flex-1">
              {guardando ? 'Creando…' : 'Crear auditoría'}
            </Boton>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
