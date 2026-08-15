import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Plus, Pencil, Trash2, X, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { supabase } from '@/lib/supabase'
import {
  getOrganizacion,
  getRanchos,
  crearRancho,
  actualizarRancho,
  desactivarRancho,
  actualizarAdminEditaAjenos,
} from '@/lib/queries'
import type { Organizacion, Rancho } from '@/types/database.types'

const CULTIVOS = ['Zarzamora', 'Frambuesa', 'Fresa', 'Mora azul', 'Coco']
const CULTIVO_OTRO = '__otro__'

const LIMITE_POR_PLAN: Record<string, number | null> = {
  pendiente: 0,
  basico: 5,
  free: null,
  personalizado: null,
}

const PLAN_LABELS: Record<string, string> = {
  pendiente: 'Pendiente de activación',
  basico: 'Básico',
  personalizado: 'Personalizado',
  free: 'Free',
}

function parsearErrorLimiteSitios(mensaje: string, plan?: string | null, pluralSimple = 'Ranchos'): string {
  const pluralL = pluralSimple.toLowerCase()
  if (plan === 'pendiente' || mensaje.includes('pendiente de activación')) {
    return 'Tu cuenta está pendiente de activación. Si ya realizaste tu pago, en breve activaremos tu plan.'
  }
  const match = mensaje.match(/l[ií]mite[:\s=]+(\d+)/i) ?? mensaje.match(/(\d+)\s*rancho/i)
  const limite = match ? match[1] : null
  const planLabel = plan ? (PLAN_LABELS[plan] ?? plan) : null
  if (planLabel && limite) {
    return `Tu plan ${planLabel} permite hasta ${limite} ${pluralL}. Para agregar más, solicita un plan personalizado.`
  }
  if (limite) {
    return `Has alcanzado el límite de ${limite} ${pluralL} de tu plan. Para agregar más, solicita un plan personalizado.`
  }
  return `Has alcanzado el límite de ${pluralL} de tu plan. Para agregar más, solicita un plan personalizado.`
}

interface FormRancho {
  nombre: string
  codigo: string
  cultivo: string
  cultivoOtro: string
  superficie_ha: string
}

const FORM_VACÍO: FormRancho = { nombre: '', codigo: '', cultivo: '', cultivoOtro: '', superficie_ha: '' }

export function MiOrganizacion() {
  const navigate = useNavigate()
  const { profile, productor } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const sTermino = terminosSitio.singular
  const sTerminoL = sTermino.toLowerCase()
  const sPlural = terminosSitio.pluralSimple
  const sPluralL = sPlural.toLowerCase()
  const sGenero = terminosSitio.genero

  const [organizacion, setOrganizacion] = useState<Organizacion | null>(null)
  const [ranchos, setRanchos] = useState<Rancho[]>([])
  const [cargando, setCargando] = useState(true)

  const esPendiente = organizacion?.plan === 'pendiente'
  const limiteActual = esPendiente ? null : (organizacion ? (LIMITE_POR_PLAN[organizacion.plan] ?? null) : null)
  const enLimite = limiteActual !== null && ranchos.length >= limiteActual
  const bloqueado = esPendiente || enLimite

  const esAdmin = profile?.rol === 'admin_org'
  const [actualizandoToggle, setActualizandoToggle] = useState(false)

  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [ranchoEditando, setRanchoEditando] = useState<Rancho | null>(null)
  const [form, setForm] = useState<FormRancho>(FORM_VACÍO)
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState<Partial<FormRancho>>({})

  useEffect(() => {
    if (!profile?.org_id) return
    cargar()
  }, [profile?.org_id, productor?.id])

  async function cargar() {
    setCargando(true)
    try {
      const [org, listaRanchos] = await Promise.all([
        getOrganizacion(profile!.org_id!),
        productor ? getRanchos(productor.id) : Promise.resolve([]),
      ])
      setOrganizacion(org)
      setRanchos(listaRanchos)
    } catch {
      toast.error('Error al cargar los datos')
    } finally {
      setCargando(false)
    }
  }

  function abrirCrear() {
    setRanchoEditando(null)
    setForm(FORM_VACÍO)
    setErrores({})
    setSheetAbierto(true)
  }

  function abrirEditar(rancho: Rancho) {
    setRanchoEditando(rancho)
    const esPersonalizado = !CULTIVOS.includes(rancho.cultivo)
    setForm({
      nombre: rancho.nombre,
      codigo: rancho.codigo,
      cultivo: esPersonalizado ? CULTIVO_OTRO : rancho.cultivo,
      cultivoOtro: esPersonalizado ? rancho.cultivo : '',
      superficie_ha: rancho.superficie_ha?.toString() ?? '',
    })
    setErrores({})
    setSheetAbierto(true)
  }

  function cerrarSheet() {
    setSheetAbierto(false)
    setRanchoEditando(null)
  }

  function validar(): boolean {
    const e: Partial<FormRancho> = {}
    if (!form.nombre.trim()) e.nombre = 'El nombre es requerido'
    if (!ranchoEditando && !form.codigo.trim()) e.codigo = 'El código es requerido'
    if (!form.cultivo) e.cultivo = 'Selecciona un cultivo'
    else if (form.cultivo === CULTIVO_OTRO && !form.cultivoOtro.trim()) e.cultivoOtro = 'Especifica el cultivo'
    const sup = parseFloat(form.superficie_ha)
    if (!form.superficie_ha || isNaN(sup) || sup <= 0) e.superficie_ha = 'Debe ser mayor a 0'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function obtenerProductorId(): Promise<string> {
    if (productor?.id) return productor.id
    // Busca el productor por profile_id (creado automáticamente en el onboarding)
    const { data: existente } = await supabase
      .from('productores')
      .select('id')
      .eq('profile_id', profile!.id)
      .single()
    if (existente?.id) return existente.id
    // Fallback: crear productor si no existe
    const { data: nuevo, error } = await supabase
      .from('productores')
      .insert({ profile_id: profile!.id, org_id: profile!.org_id! })
      .select('id')
      .single()
    if (error) throw new Error('No se pudo crear el productor: ' + error.message)
    return nuevo.id
  }

  async function handleGuardar() {
    if (!validar()) return
    setGuardando(true)
    const cultivoFinal = form.cultivo === CULTIVO_OTRO ? form.cultivoOtro.trim() : form.cultivo
    try {
      if (ranchoEditando) {
        await actualizarRancho(ranchoEditando.id, {
          nombre: form.nombre.trim(),
          cultivo: cultivoFinal,
          superficie_ha: parseFloat(form.superficie_ha),
        })
        toast.success(`${sTermino} ${sGenero === 'f' ? 'actualizada' : 'actualizado'}`)
      } else {
        const productorId = await obtenerProductorId()
        const codigoNorm = form.codigo.trim().toUpperCase()
        // Verificar duplicado solo dentro del mismo productor (igual al constraint UNIQUE(productor_id, codigo))
        const { data: yaExiste } = await (supabase as any)
          .from('ranchos')
          .select('id')
          .eq('productor_id', productorId)
          .eq('codigo', codigoNorm)
          .maybeSingle()
        if (yaExiste) {
          setErrores({ codigo: `Ya existe ${sGenero === 'f' ? 'una' : 'un'} ${sTerminoL} con este código` })
          return
        }
        await crearRancho({
          nombre: form.nombre.trim(),
          codigo: codigoNorm,
          cultivo: cultivoFinal,
          superficie_ha: parseFloat(form.superficie_ha),
          productor_id: productorId,
          org_id: profile!.org_id!,
        })
        toast.success(`${sTermino} ${sGenero === 'f' ? 'creada' : 'creado'}`)
      }
      cerrarSheet()
      await cargar()
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : (err as any)?.message) ?? ''
      if (msg.includes('LIMITE_RANCHOS_PLAN')) {
        toast.warning(parsearErrorLimiteSitios(msg, organizacion?.plan, sPlural), { duration: 7000 })
      } else if (msg.includes('ranchos_productor_id_codigo_key')) {
        // Constraint de BD: UNIQUE(productor_id, codigo) — caso de carrera (TOCTOU)
        setErrores({ codigo: `Ya existe ${sGenero === 'f' ? 'una' : 'un'} ${sTerminoL} con este código` })
      } else {
        toast.error('No se pudo guardar los cambios')
      }
    } finally {
      setGuardando(false)
    }
  }

  async function handleToggleAdminEdita(valor: boolean) {
    if (!profile?.org_id) return
    setActualizandoToggle(true)
    try {
      await actualizarAdminEditaAjenos(profile.org_id, valor)
      setOrganizacion((prev) => prev ? { ...prev, admin_edita_ajenos: valor } : prev)
      toast.success(valor ? 'El administrador puede editar registros de empleados' : 'El administrador solo puede ver y marcar correcciones')
    } catch {
      toast.error('No se pudo actualizar la configuración')
    } finally {
      setActualizandoToggle(false)
    }
  }

  async function handleEliminar(rancho: Rancho) {
    if (!window.confirm(`¿Eliminar ${sGenero === 'f' ? 'la' : 'el'} ${sTerminoL} "${rancho.nombre}"?`)) return
    try {
      await desactivarRancho(rancho.id)
      toast.success(`${sTermino} ${sGenero === 'f' ? 'eliminada' : 'eliminado'}`)
      await cargar()
    } catch {
      toast.error(`No se pudo eliminar`)
    }
  }

  return (
    <div className="min-h-full pb-safe-nav">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/perfil')}
          className="p-1 text-muted-foreground"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-foreground" style={{ fontWeight: 600 }}>
          Mi organización
        </h1>
      </header>

      <div className="p-4 space-y-4">
        {cargando ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <>
            {/* Nombre de la organización */}
            {organizacion && (
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1" style={{ fontWeight: 600 }}>
                  ORGANIZACIÓN
                </p>
                <p className="text-foreground" style={{ fontWeight: 600 }}>
                  {organizacion.nombre}
                </p>
              </div>
            )}

            {/* Configuración del equipo — solo admin_org */}
            {esAdmin && organizacion && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <p className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                  GESTIÓN DEL EQUIPO
                </p>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>
                      Editar registros de empleados
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {organizacion.admin_edita_ajenos
                        ? 'Activado: puedes editar y borrar los registros de tus empleados.'
                        : 'Desactivado: solo puedes ver los registros de tus empleados y marcarlos para corrección.'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleAdminEdita(!organizacion.admin_edita_ajenos)}
                    disabled={actualizandoToggle}
                    className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
                    style={{
                      backgroundColor: organizacion.admin_edita_ajenos ? 'var(--primary)' : 'var(--switch-background)',
                    }}
                    aria-label="Toggle edición de ajenos"
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                      style={{ transform: organizacion.admin_edita_ajenos ? 'translateX(22px)' : 'translateX(2px)' }}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* Lista de ranchos */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                  {sPlural.toUpperCase()} ({ranchos.length}{limiteActual !== null ? ` de ${limiteActual}` : ''})
                </p>
                {limiteActual !== null && (
                  <p className="text-xs text-muted-foreground">
                    {ranchos.length < limiteActual
                      ? `${limiteActual - ranchos.length} disponible${limiteActual - ranchos.length !== 1 ? 's' : ''}`
                      : 'Límite alcanzado'}
                  </p>
                )}
              </div>

              {esPendiente && (
                <div
                  className="mb-3 rounded-xl px-4 py-3 flex items-start gap-3"
                  style={{ background: 'var(--agro-warning-fill)' }}
                >
                  <AlertTriangle
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    style={{ color: 'var(--agro-warning-text)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm"
                      style={{ color: 'var(--agro-warning-text)', fontWeight: 600 }}
                    >
                      Cuenta pendiente de activación
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--agro-warning-text)' }}>
                      Si ya realizaste tu pago, en breve activaremos tu plan.
                    </p>
                  </div>
                </div>
              )}

              {enLimite && !esPendiente && (
                <div
                  className="mb-3 rounded-xl px-4 py-3 flex items-start gap-3"
                  style={{ background: 'var(--agro-warning-fill)' }}
                >
                  <AlertTriangle
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    style={{ color: 'var(--agro-warning-text)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm"
                      style={{ color: 'var(--agro-warning-text)', fontWeight: 600 }}
                    >
                      Has alcanzado el límite de tu plan ({limiteActual} {sPluralL}).
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--agro-warning-text)' }}>
                      Para agregar más, solicita un plan personalizado.
                    </p>
                  </div>
                </div>
              )}

              {ranchos.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-6 text-center">
                  <p className="text-sm text-muted-foreground">No hay {sPluralL} registrados</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Toca + para agregar {sGenero === 'f' ? 'la primera' : 'el primero'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {ranchos.map((r) => (
                    <div
                      key={r.id}
                      className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className="text-foreground text-sm truncate"
                            style={{ fontWeight: 600 }}
                          >
                            {r.nombre}
                          </span>
                          <span className="text-[11px] bg-muted text-muted-foreground rounded px-1.5 py-0.5 flex-shrink-0 font-mono">
                            {r.codigo}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {r.cultivo}
                          {r.superficie_ha ? ` · ${r.superficie_ha} ha` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => abrirEditar(r)}
                          className="p-2 text-muted-foreground hover:text-primary transition-colors"
                          aria-label={`Editar ${sTerminoL}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEliminar(r)}
                          className="p-2 text-muted-foreground hover:text-agro-red transition-colors"
                          aria-label={`Eliminar ${sTerminoL}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-safe-fab left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10">
        <button
          onClick={bloqueado ? undefined : abrirCrear}
          disabled={bloqueado}
          className="w-14 h-14 rounded-full text-white flex items-center justify-center shadow-lg pointer-events-auto transition-colors"
          style={{
            background: bloqueado ? 'var(--muted-foreground)' : 'var(--primary)',
            cursor: bloqueado ? 'not-allowed' : 'pointer',
            opacity: bloqueado ? 0.5 : 1,
          }}
          aria-label={
            esPendiente
              ? 'Cuenta pendiente de activación'
              : enLimite
                ? `Límite de ${sPluralL} alcanzado`
                : terminosSitio.agregar
          }
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom Sheet */}
      {sheetAbierto && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-30"
            onClick={cerrarSheet}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-40 bg-card flex flex-col overflow-hidden"
            style={{
              height: '85%',
              borderRadius: '0.625rem 0.625rem 0 0',
              maxWidth: 390,
              margin: '0 auto',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                {ranchoEditando ? `Editar ${sTerminoL}` : `Nuevo ${sTerminoL}`}
              </h2>
              <button onClick={cerrarSheet} className="p-1">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Campos */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Nombre */}
              <div>
                <label
                  className="block text-xs text-muted-foreground mb-1.5"
                  style={{ fontWeight: 600 }}
                >
                  NOMBRE {sGenero === 'f' ? 'DE LA' : 'DEL'} {sTermino.toUpperCase()} *
                </label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder={`Ej: ${sTermino} El Solar`}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errores.nombre ? 'border-agro-red' : 'border-border'
                  }`}
                />
                {errores.nombre && (
                  <p className="text-xs text-agro-red mt-1">{errores.nombre}</p>
                )}
              </div>

              {/* Código — solo al crear */}
              {!ranchoEditando && (
                <div>
                  <label
                    className="block text-xs text-muted-foreground mb-1.5"
                    style={{ fontWeight: 600 }}
                  >
                    CÓDIGO *
                  </label>
                  <input
                    value={form.codigo}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))
                    }
                    placeholder="Ej: RS-01"
                    className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                      errores.codigo ? 'border-agro-red' : 'border-border'
                    }`}
                  />
                  {errores.codigo && (
                    <p className="text-xs text-agro-red mt-1">{errores.codigo}</p>
                  )}
                </div>
              )}

              {/* Cultivo */}
              <div>
                <label
                  className="block text-xs text-muted-foreground mb-1.5"
                  style={{ fontWeight: 600 }}
                >
                  CULTIVO *
                </label>
                <select
                  value={form.cultivo}
                  onChange={(e) => setForm((f) => ({ ...f, cultivo: e.target.value }))}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errores.cultivo ? 'border-agro-red' : 'border-border'
                  } ${!form.cultivo ? 'text-muted-foreground' : 'text-foreground'}`}
                >
                  <option value="" disabled>
                    Seleccionar cultivo
                  </option>
                  {CULTIVOS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value={CULTIVO_OTRO}>Otro (especificar)…</option>
                </select>
                {errores.cultivo && (
                  <p className="text-xs text-agro-red mt-1">{errores.cultivo}</p>
                )}
                {form.cultivo === CULTIVO_OTRO && (
                  <div className="mt-2">
                    <input
                      value={form.cultivoOtro}
                      onChange={(e) => setForm((f) => ({ ...f, cultivoOtro: e.target.value }))}
                      placeholder="Especifica el cultivo"
                      className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                        errores.cultivoOtro ? 'border-agro-red' : 'border-border'
                      }`}
                    />
                    {errores.cultivoOtro && (
                      <p className="text-xs text-agro-red mt-1">{errores.cultivoOtro}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Superficie */}
              <div>
                <label
                  className="block text-xs text-muted-foreground mb-1.5"
                  style={{ fontWeight: 600 }}
                >
                  SUPERFICIE (ha) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.superficie_ha}
                  onChange={(e) => setForm((f) => ({ ...f, superficie_ha: e.target.value }))}
                  placeholder="Ej: 5.5"
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errores.superficie_ha ? 'border-agro-red' : 'border-border'
                  }`}
                />
                {errores.superficie_ha && (
                  <p className="text-xs text-agro-red mt-1">{errores.superficie_ha}</p>
                )}
              </div>
            </div>

            {/* Botón guardar */}
            <div className="p-4 border-t border-border flex-shrink-0">
              <button
                onClick={handleGuardar}
                disabled={guardando}
                className="w-full h-14 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors"
                style={{ fontWeight: 600 }}
              >
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                {ranchoEditando ? 'Guardar cambios' : `Crear ${sTerminoL}`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
