import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import {
  ChevronLeft, ChevronDown, Pencil, Trash2, X, Loader2, AlertTriangle, Users, Check, Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { supabase } from '@/lib/supabase'
import { Switch } from '@/app/components/ui/switch'
import { Skeleton } from '@/app/components/ui/skeleton'
import { useMostrarCarga } from '@/hooks/useMostrarCarga'
import {
  getOrganizacion,
  getRanchos,
  crearRancho,
  actualizarRancho,
  desactivarRancho,
  actualizarAdminEditaAjenos,
  getEmpleadosOrg,
  getAsignacionesOrg,
  asignarRanchoEmpleado,
  desasignarRanchoEmpleado,
  getSectoresLista,
  darBajaMiembro,
  reactivarMiembro,
  getMiembrosBaja,
  type SectorLista,
  type MiembroBaja,
  type EmpleadoBasicoConRol,
} from '@/lib/queries'
import type { Organizacion, Rancho } from '@/types/database.types'
import { Fab } from '@/app/components/Fab'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { ConfirmarSheet } from '@/app/components/ui-mady/ConfirmarSheet'
import { resolverIcono } from '@/app/components/iconos-modulos'
import { AvisoCargaLenta } from '@/app/components/ui-mady/AvisoCargaLenta'

const CULTIVOS = ['Zarzamora', 'Frambuesa', 'Fresa', 'Mora azul', 'Coco']
const CULTIVO_OTRO = '__otro__'

const LIMITE_POR_PLAN: Record<string, number | null> = {
  pendiente: 0,
  basico: 5,
  free: null,
  personalizado: null,
}

const ROL_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  admin_org: 'Administrador',
  asesor_tecnico: 'Asesor técnico',
  operario: 'Operario',
  auditor: 'Auditor',
}

interface Colaborador { id: string; nombre: string; rol: string }

function formatearFecha(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
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
  sector_id: string
  cultivo: string
  cultivoOtro: string
  superficie_ha: string
}

const FORM_VACÍO: FormRancho = { nombre: '', codigo: '', sector_id: '', cultivo: '', cultivoOtro: '', superficie_ha: '' }

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
  const [empleados, setEmpleados] = useState<EmpleadoBasicoConRol[]>([])
  // Map profile_id → Set<rancho_id>
  const [asignaciones, setAsignaciones] = useState<Map<string, Set<string>>>(new Map())
  const [sectores, setSectores] = useState<SectorLista[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [bajas, setBajas] = useState<MiembroBaja[]>([])
  const [bajasAbiertas, setBajasAbiertas] = useState(false)
  const [cargando, setCargando] = useState(true)
  const mostrarSkeleton = useMostrarCarga(cargando, !!organizacion)

  const esIlimitado = organizacion ? LIMITE_POR_PLAN[organizacion.plan] === null : false
  const esPendiente = organizacion?.plan === 'pendiente'
  const limiteActual = esPendiente ? null : (organizacion ? (LIMITE_POR_PLAN[organizacion.plan] ?? null) : null)
  const enLimite = limiteActual !== null && ranchos.length >= limiteActual
  const bloqueado = esPendiente || enLimite

  const esAdmin = profile?.rol === 'admin_org' || profile?.rol === 'super_admin'
  const [actualizandoToggle, setActualizandoToggle] = useState(false)

  // ── Sheet rancho ─────────────────────────────────────────────────────────────
  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [ranchoEditando, setRanchoEditando] = useState<Rancho | null>(null)
  const [form, setForm] = useState<FormRancho>(FORM_VACÍO)
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState<Partial<FormRancho>>({})

  // ── Sheet asignación ─────────────────────────────────────────────────────────
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<EmpleadoBasicoConRol | null>(null)
  const [asignandoRancho, setAsignandoRancho] = useState<string | null>(null)

  // ── Baja de miembros ─────────────────────────────────────────────────────────
  const [bajaObjetivo, setBajaObjetivo] = useState<Colaborador | null>(null)
  const [bajaMotivo, setBajaMotivo] = useState('')
  const [reactivandoId, setReactivandoId] = useState<string | null>(null)

  const sectorPorId = useMemo(() => new Map(sectores.map((x) => [x.id, x])), [sectores])
  const sectorForm = sectorPorId.get(form.sector_id)
  const pideCultivo = sectorForm?.pide_cultivo ?? false

  useEffect(() => {
    if (!profile?.org_id) return
    cargar()
  }, [profile?.org_id])

  async function cargar() {
    setCargando(true)
    try {
      const [org, listaRanchos, listaEmpleados, listaAsignaciones, listaSectores, listaColab, listaBajas] = await Promise.all([
        getOrganizacion(profile!.org_id!),
        // Sin filtro de productor — RLS muestra todos los ranchos de la org para admin
        getRanchos(),
        esAdmin ? getEmpleadosOrg(profile!.org_id!) : Promise.resolve([]),
        esAdmin ? getAsignacionesOrg(profile!.org_id!) : Promise.resolve([]),
        getSectoresLista().catch(() => [] as SectorLista[]),
        esAdmin
          ? Promise.resolve((supabase as any).rpc('org_colaboradores'))
              .then(({ data }: { data: Colaborador[] | null }) => data ?? [])
              .catch(() => [] as Colaborador[])
          : Promise.resolve([] as Colaborador[]),
        esAdmin ? getMiembrosBaja().catch(() => [] as MiembroBaja[]) : Promise.resolve([] as MiembroBaja[]),
      ])
      setOrganizacion(org)
      setRanchos(listaRanchos)
      setEmpleados(listaEmpleados)
      setSectores(listaSectores)
      setColaboradores(listaColab)
      setBajas(listaBajas)

      const mapa = new Map<string, Set<string>>()
      for (const a of listaAsignaciones) {
        if (!mapa.has(a.profile_id)) mapa.set(a.profile_id, new Set())
        mapa.get(a.profile_id)!.add(a.rancho_id)
      }
      setAsignaciones(mapa)
    } catch {
      toast.error('Error al cargar los datos')
    } finally {
      setCargando(false)
    }
  }

  // ── Rancho CRUD ───────────────────────────────────────────────────────────────

  function abrirCrear() {
    setRanchoEditando(null)
    setForm(FORM_VACÍO)
    setErrores({})
    setSheetAbierto(true)
  }

  function abrirEditar(rancho: Rancho) {
    setRanchoEditando(rancho)
    const cultivoActual = rancho.cultivo ?? ''
    const esPersonalizado = cultivoActual !== '' && !CULTIVOS.includes(cultivoActual)
    setForm({
      nombre: rancho.nombre,
      codigo: rancho.codigo,
      sector_id: rancho.sector_id ?? '',
      cultivo: esPersonalizado ? CULTIVO_OTRO : cultivoActual,
      cultivoOtro: esPersonalizado ? cultivoActual : '',
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
    if (!form.sector_id) e.sector_id = 'Selecciona un sector'
    if (pideCultivo) {
      if (!form.cultivo) e.cultivo = 'Selecciona un cultivo'
      else if (form.cultivo === CULTIVO_OTRO && !form.cultivoOtro.trim()) e.cultivoOtro = 'Especifica el cultivo'
      const sup = parseFloat(form.superficie_ha)
      if (!form.superficie_ha || isNaN(sup) || sup <= 0) e.superficie_ha = 'Debe ser mayor a 0'
    }
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function obtenerProductorId(): Promise<string> {
    if (productor?.id) return productor.id
    const { data: existente } = await supabase
      .from('productores')
      .select('id')
      .eq('profile_id', profile!.id)
      .maybeSingle()
    if (existente?.id) return existente.id
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
    // Fuera de campo/invernadero no se manda cultivo ni superficie.
    const cultivoFinal = !pideCultivo ? null : form.cultivo === CULTIVO_OTRO ? form.cultivoOtro.trim() : form.cultivo
    const superficieFinal = pideCultivo ? parseFloat(form.superficie_ha) : null
    try {
      if (ranchoEditando) {
        await actualizarRancho(ranchoEditando.id, {
          nombre: form.nombre.trim(),
          sector_id: form.sector_id,
          cultivo: cultivoFinal,
          superficie_ha: superficieFinal,
        })
        toast.success(`${sTermino} ${sGenero === 'f' ? 'actualizada' : 'actualizado'}`)
      } else {
        const productorId = await obtenerProductorId()
        const codigoNorm = form.codigo.trim().toUpperCase()
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
          sector_id: form.sector_id,
          cultivo: cultivoFinal,
          superficie_ha: superficieFinal,
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
      } else if (msg.includes('CULTIVO_REQUERIDO')) {
        setErrores({ cultivo: 'Selecciona un cultivo' })
      } else if (msg.includes('SUPERFICIE_REQUERIDA')) {
        setErrores({ superficie_ha: 'Debe ser mayor a 0' })
      } else if (msg.includes('ranchos_productor_id_codigo_key')) {
        setErrores({ codigo: `Ya existe ${sGenero === 'f' ? 'una' : 'un'} ${sTerminoL} con este código` })
      } else {
        toast.error('No se pudo guardar los cambios')
      }
    } finally {
      setGuardando(false)
    }
  }

  async function handleToggleAdminEdita(valor: boolean) {
    if (!profile?.org_id || actualizandoToggle) return
    const valorAnterior = organizacion?.admin_edita_ajenos ?? false
    // Actualización optimista: refleja el cambio de inmediato en el switch.
    setOrganizacion((prev) => prev ? { ...prev, admin_edita_ajenos: valor } : prev)
    setActualizandoToggle(true)
    try {
      await actualizarAdminEditaAjenos(profile.org_id, valor)
      toast.success(valor ? 'El administrador puede editar registros de empleados' : 'El administrador solo puede ver y marcar correcciones')
    } catch (err) {
      // Falló la escritura (o RLS la bloqueó en silencio) — revertir al valor previo.
      setOrganizacion((prev) => prev ? { ...prev, admin_edita_ajenos: valorAnterior } : prev)
      console.error('[MiOrganizacion] actualizarAdminEditaAjenos', err)
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

  // ── Asignación de sitios a empleados ─────────────────────────────────────────

  const asignacionesEmpleado = useMemo(() => {
    if (!empleadoSeleccionado) return new Set<string>()
    return asignaciones.get(empleadoSeleccionado.id) ?? new Set<string>()
  }, [empleadoSeleccionado, asignaciones])

  async function handleToggleAsignacion(ranchoId: string) {
    if (!empleadoSeleccionado || asignandoRancho) return
    const tieneAsignado = asignacionesEmpleado.has(ranchoId)
    setAsignandoRancho(ranchoId)
    try {
      if (tieneAsignado) {
        await desasignarRanchoEmpleado(empleadoSeleccionado.id, ranchoId)
      } else {
        await asignarRanchoEmpleado(empleadoSeleccionado.id, ranchoId)
        const nombreSector = sectorPorId.get(ranchos.find((r) => r.id === ranchoId)?.sector_id ?? '')?.nombre
        toast.success(
          nombreSector
            ? `Asignado. ${empleadoSeleccionado.nombre_completo} verá los módulos de ${nombreSector} al volver a entrar.`
            : 'Asignado.',
        )
      }
      // Actualizar estado local
      setAsignaciones((prev) => {
        const siguiente = new Map(prev)
        const set = new Set(siguiente.get(empleadoSeleccionado.id) ?? [])
        if (tieneAsignado) {
          set.delete(ranchoId)
        } else {
          set.add(ranchoId)
        }
        siguiente.set(empleadoSeleccionado.id, set)
        return siguiente
      })
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : (err as any)?.message) ?? ''
      toast.error(
        msg.includes('FORBIDDEN')
          ? `Ese ${sTerminoL} y el colaborador deben ser de tu organización`
          : 'No se pudo actualizar la asignación',
      )
    } finally {
      setAsignandoRancho(null)
    }
  }

  // ── Baja de miembros ─────────────────────────────────────────────────────────

  function cerrarBaja() {
    setBajaObjetivo(null)
    setBajaMotivo('')
  }

  async function handleConfirmarBaja() {
    const objetivo = bajaObjetivo
    if (!objetivo) return
    const motivo = bajaMotivo
    cerrarBaja()
    try {
      const { tareas_abiertas } = await darBajaMiembro(objetivo.id, motivo)
      toast.success(`${objetivo.nombre} fue dado de baja`)
      if (tareas_abiertas > 0) {
        toast.warning(
          `Tenía ${tareas_abiertas} ${tareas_abiertas === 1 ? 'tarea abierta' : 'tareas abiertas'} en Agenda; reasígnalas.`,
          { duration: 7000 },
        )
      }
      await cargar()
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : (err as any)?.message) ?? ''
      if (msg.includes('ULTIMO_ADMIN')) toast.error('Debe quedar al menos un administrador activo en la organización')
      else if (msg.includes('FORBIDDEN')) toast.error('No puedes dar de baja a esta cuenta')
      else toast.error('No se pudo dar de baja')
    }
  }

  async function handleReactivar(m: MiembroBaja) {
    if (reactivandoId) return
    setReactivandoId(m.id)
    try {
      await reactivarMiembro(m.id)
      toast.success(`${m.nombre} fue reactivado. Asígnale sus ${sPluralL} de nuevo.`)
      await cargar()
    } catch {
      toast.error('No se pudo reactivar')
    } finally {
      setReactivandoId(null)
    }
  }

  function sectorDe(r: Rancho): SectorLista | undefined {
    return r.sector_id ? sectorPorId.get(r.sector_id) : undefined
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full pb-safe-nav">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4 sticky top-0 z-20 flex items-center gap-3">
        <button aria-label="Volver"
          onClick={() => navigate('/perfil')}
          className="p-3 -m-2 rounded-lg text-muted-foreground flex-shrink-0 transition-colors hover:bg-muted"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-foreground flex-1 min-w-0 truncate font-semibold">
          Mi organización
        </h1>
      </header>

      <div className="p-4 space-y-4">
        {mostrarSkeleton ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <AvisoCargaLenta />
          </div>
        ) : cargando && !organizacion ? (
          <div style={{ minHeight: '280px' }} />
        ) : (
          <>
            {/* Nombre de la organización */}
            {organizacion && (
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1 font-semibold">
                  ORGANIZACIÓN
                </p>
                <p className="text-foreground font-semibold">
                  {organizacion.nombre}
                </p>
              </div>
            )}

            {/* Configuración del equipo — solo admin */}
            {esAdmin && organizacion && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <p className="text-xs text-muted-foreground font-semibold">
                  GESTIÓN DEL EQUIPO
                </p>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-semibold">
                      Editar registros de empleados
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {organizacion.admin_edita_ajenos
                        ? 'Activado: puedes editar y borrar los registros de tus empleados.'
                        : 'Desactivado: solo puedes ver los registros de tus empleados y marcarlos para corrección.'}
                    </p>
                  </div>
                  <Switch
                    checked={organizacion.admin_edita_ajenos}
                    onCheckedChange={handleToggleAdminEdita}
                    disabled={actualizandoToggle}
                    aria-label="Editar registros de empleados"
                    className="flex-shrink-0"
                  />
                </div>
              </div>
            )}

            {/* Asignación de sitios a operarios — solo admin */}
            {esAdmin && empleados.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground font-semibold">
                    ASIGNACIÓN DE {sPlural.toUpperCase()} A OPERARIOS
                  </p>
                </div>
                <div className="space-y-2">
                  {empleados.map((emp) => {
                    const count = asignaciones.get(emp.id)?.size ?? 0
                    return (
                      <button
                        key={emp.id}
                        onClick={() => setEmpleadoSeleccionado(emp)}
                        className="w-full flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-muted hover:bg-border transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs text-primary font-semibold">
                              {(emp.nombre_completo ?? '').split(' ').slice(0, 2).map((p) => p[0] ?? '').join('').toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm text-foreground truncate font-semibold">
                            {emp.nombre_completo ?? 'Sin nombre'}
                          </span>
                        </div>
                        <span
                          className="text-xs flex-shrink-0 px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            background: count > 0 ? 'var(--primary)' : 'var(--muted-foreground)',
                            color: '#fff',
                          }}
                        >
                          {count} {count === 1 ? sTerminoL : sPluralL}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Equipo — dar de baja (solo admin) */}
            {esAdmin && colaboradores.some((c) => c.id !== profile?.id) && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <p className="text-xs text-muted-foreground font-semibold">EQUIPO</p>
                <div className="space-y-2">
                  {colaboradores.filter((c) => c.id !== profile?.id).map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 py-1">
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate font-semibold">{c.nombre || 'Sin nombre'}</p>
                        <p className="text-xs text-muted-foreground">{ROL_LABELS[c.rol] ?? c.rol}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBajaObjetivo(c)}
                        className="text-xs font-semibold px-3 py-2 -my-2 rounded-lg text-agro-red hover:bg-muted transition-colors flex-shrink-0"
                      >
                        Dar de baja
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Miembros dados de baja (solo admin) */}
            {esAdmin && bajas.length > 0 && (
              <div className="bg-card border border-border rounded-xl">
                <button
                  type="button"
                  onClick={() => setBajasAbiertas((v) => !v)}
                  aria-expanded={bajasAbiertas}
                  className="w-full flex items-center justify-between gap-3 p-4 text-left"
                >
                  <p className="text-xs text-muted-foreground font-semibold">
                    MIEMBROS DADOS DE BAJA ({bajas.length})
                  </p>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${bajasAbiertas ? 'rotate-180' : ''}`} />
                </button>
                {bajasAbiertas && (
                  <div className="px-4 pb-4 space-y-3">
                    {bajas.map((m) => (
                      <div key={m.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate font-semibold">{m.nombre || 'Sin nombre'}</p>
                          <p className="text-xs text-muted-foreground">
                            {ROL_LABELS[m.rol] ?? m.rol}{m.baja_en ? ` · ${formatearFecha(m.baja_en)}` : ''}
                          </p>
                          {m.baja_motivo && <p className="text-xs text-muted-foreground mt-0.5">{m.baja_motivo}</p>}
                          {m.baja_por && <p className="text-xs text-muted-foreground">Por {m.baja_por}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleReactivar(m)}
                          disabled={!!reactivandoId}
                          className="text-xs font-semibold px-3 py-2 rounded-lg border border-border-control text-foreground hover:bg-muted transition-colors flex-shrink-0 disabled:opacity-50"
                        >
                          {reactivandoId === m.id ? 'Reactivando…' : 'Reactivar'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Lista de ranchos */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs text-muted-foreground font-semibold">
                  {sPlural.toUpperCase()} ({ranchos.length}{limiteActual !== null ? ` de ${limiteActual}` : ''})
                </p>
                {esIlimitado ? (
                  <p className="text-xs text-muted-foreground">
                    Ilimitado
                  </p>
                ) : limiteActual !== null ? (
                  <p className="text-xs text-muted-foreground">
                    {ranchos.length < limiteActual
                      ? `${limiteActual - ranchos.length} disponible${limiteActual - ranchos.length !== 1 ? 's' : ''}`
                      : 'Límite alcanzado'}
                  </p>
                ) : null}
              </div>

              {esPendiente && (
                <div
                  className="mb-3 rounded-xl px-4 py-3 flex items-start gap-3"
                  style={{ background: 'var(--agro-info-fill)' }}
                >
                  <AlertTriangle
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    style={{ color: 'var(--agro-info-text)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: 'var(--agro-info-text)' }}
                    >
                      Cuenta pendiente de activación
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--agro-info-text)' }}>
                      Si ya realizaste tu pago, en breve activaremos tu plan.
                    </p>
                  </div>
                </div>
              )}

              {enLimite && !esPendiente && (
                <div
                  className="mb-3 rounded-xl px-4 py-3 flex items-start gap-3"
                  style={{ background: 'var(--agro-info-fill)' }}
                >
                  <AlertTriangle
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    style={{ color: 'var(--agro-info-text)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: 'var(--agro-info-text)' }}
                    >
                      Has alcanzado el límite de tu plan ({limiteActual} {sPluralL}).
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--agro-info-text)' }}>
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
                            className="text-foreground text-sm truncate font-semibold"
                          >
                            {r.nombre}
                          </span>
                          <Etiqueta tono="neutral">
                            {r.codigo}
                          </Etiqueta>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-x-1.5 flex-wrap">
                          {sectorDe(r) && <SectorChip sector={sectorDe(r)!} />}
                          {[r.cultivo, r.superficie_ha ? `${r.superficie_ha} ha` : null].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {esAdmin && (
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
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* FAB — solo admin */}
      {esAdmin && (
                <Fab onClick={bloqueado ? undefined : abrirCrear} aria-label={esPendiente
                ? 'Cuenta pendiente de activación'
                : enLimite
                  ? `Límite de ${sPluralL} alcanzado`
                  : terminosSitio.agregar} disabled={bloqueado} />
      )}

      {/* Bottom Sheet — crear/editar rancho */}
      <BottomSheet open={sheetAbierto} onClose={cerrarSheet}>

            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
              <h2 className="text-base text-foreground font-semibold">
                {ranchoEditando ? `Editar ${sTerminoL}` : `Nuevo ${sTerminoL}`}
              </h2>
              <button type="button" aria-label="Cerrar" onClick={cerrarSheet} className="p-3 -m-2">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-semibold">
                  NOMBRE {sGenero === 'f' ? 'DE LA' : 'DEL'} {sTermino.toUpperCase()} *
                </label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder={`Ej: ${sTermino} El Solar`}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errores.nombre ? 'border-agro-red' : 'border-border-control'
                  }`}
                />
                {errores.nombre && (
                  <p className="text-xs text-agro-red mt-1">{errores.nombre}</p>
                )}
              </div>

              {!ranchoEditando && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 font-semibold">
                    CÓDIGO *
                  </label>
                  <input
                    value={form.codigo}
                    onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                    placeholder="Ej: RS-01"
                    className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                      errores.codigo ? 'border-agro-red' : 'border-border-control'
                    }`}
                  />
                  {errores.codigo && (
                    <p className="text-xs text-agro-red mt-1">{errores.codigo}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-semibold">
                  SECTOR *
                </label>
                <select
                  value={form.sector_id}
                  onChange={(e) => setForm((f) => ({ ...f, sector_id: e.target.value }))}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errores.sector_id ? 'border-agro-red' : 'border-border-control'
                  } ${!form.sector_id ? 'text-muted-foreground' : 'text-foreground'}`}
                >
                  <option value="" disabled>Seleccionar sector</option>
                  {sectores.map((x) => (
                    <option key={x.id} value={x.id}>{x.nombre}</option>
                  ))}
                </select>
                {errores.sector_id && (
                  <p className="text-xs text-agro-red mt-1">{errores.sector_id}</p>
                )}
                {!form.sector_id && ranchoEditando && !errores.sector_id && (
                  <p className="text-xs text-muted-foreground mt-1">Elige el sector de este {sTerminoL}</p>
                )}
                {sectorForm && !sectorForm.contratado && (
                  <div
                    className="mt-2 rounded-lg px-3 py-2 flex items-start gap-2"
                    style={{ background: 'var(--agro-info-fill)' }}
                  >
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--agro-info-text)' }} />
                    <p className="text-xs" style={{ color: 'var(--agro-info-text)' }}>
                      Este sector se activará para tu organización. Los módulos que no tengas contratados aparecerán con candado.
                    </p>
                  </div>
                )}
              </div>

              {pideCultivo && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-semibold">
                  CULTIVO *
                </label>
                <select
                  value={form.cultivo}
                  onChange={(e) => setForm((f) => ({ ...f, cultivo: e.target.value }))}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errores.cultivo ? 'border-agro-red' : 'border-border-control'
                  } ${!form.cultivo ? 'text-muted-foreground' : 'text-foreground'}`}
                >
                  <option value="" disabled>Seleccionar cultivo</option>
                  {CULTIVOS.map((c) => (
                    <option key={c} value={c}>{c}</option>
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
                        errores.cultivoOtro ? 'border-agro-red' : 'border-border-control'
                      }`}
                    />
                    {errores.cultivoOtro && (
                      <p className="text-xs text-agro-red mt-1">{errores.cultivoOtro}</p>
                    )}
                  </div>
                )}
              </div>

              )}

              {pideCultivo && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-semibold">
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
                    errores.superficie_ha ? 'border-agro-red' : 'border-border-control'
                  }`}
                />
                {errores.superficie_ha && (
                  <p className="text-xs text-agro-red mt-1">{errores.superficie_ha}</p>
                )}
              </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex-shrink-0">
              <button
                onClick={handleGuardar}
                disabled={guardando}
                className="w-full h-14 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors font-semibold"
              >
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                {ranchoEditando ? 'Guardar cambios' : `Crear ${sTerminoL}`}
              </button>
            </div>
      </BottomSheet>

      {/* Bottom Sheet — asignar sitios a operario */}
      <BottomSheet open={!!empleadoSeleccionado} onClose={() => setEmpleadoSeleccionado(null)}>

            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-base text-foreground truncate font-semibold">
                  {empleadoSeleccionado?.nombre_completo ?? 'Sin nombre'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {asignacionesEmpleado.size} {asignacionesEmpleado.size === 1 ? sTerminoL : sPluralL} asignado{sGenero === 'f' ? 'a' : ''}s
                </p>
              </div>
              <button aria-label="Cerrar" onClick={() => setEmpleadoSeleccionado(null)} className="p-1 ml-2">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {ranchos.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No hay {sPluralL} registrados en la organización.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground px-1 mb-3">
                    Selecciona los {sPluralL} a los que este operario tendrá acceso.
                  </p>
                  {ranchos.map((r) => {
                    const asignado = asignacionesEmpleado.has(r.id)
                    const cargando = asignandoRancho === r.id
                    return (
                      <button
                        key={r.id}
                        onClick={() => handleToggleAsignacion(r.id)}
                        disabled={!!asignandoRancho}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border transition-colors disabled:opacity-60"
                        style={{
                          borderColor: asignado ? 'var(--primary)' : 'var(--border)',
                          backgroundColor: asignado ? 'rgba(43,122,181,0.06)' : 'var(--card)',
                        }}
                      >
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                          style={{
                            background: asignado ? 'var(--primary)' : 'transparent',
                            border: asignado ? 'none' : '1.5px solid var(--muted-foreground)',
                          }}
                        >
                          {cargando ? (
                            <Loader2 className="w-3 h-3 text-white animate-spin" />
                          ) : asignado ? (
                            <Check className="w-3 h-3 text-white" />
                          ) : null}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm text-foreground truncate" style={{ fontWeight: asignado ? 600 : 400 }}>
                            {r.nombre}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-x-1.5 flex-wrap">
                            <span>{r.codigo}</span>
                            {sectorDe(r) && <SectorChip sector={sectorDe(r)!} />}
                            {r.cultivo ? <span>{r.cultivo}</span> : null}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
      </BottomSheet>

      <ConfirmarSheet
        abierto={!!bajaObjetivo}
        titulo={`Dar de baja a ${bajaObjetivo?.nombre ?? ''}`}
        descripcion={`${bajaObjetivo?.nombre ?? 'Esta persona'} ya no podrá entrar a la app ni ver información de la organización. Sus registros y firmas se conservan.`}
        textoConfirmar="Dar de baja"
        tono="peligro"
        onConfirmar={handleConfirmarBaja}
        onCancelar={cerrarBaja}
      >
        <div>
          <label htmlFor="motivo-baja" className="block text-xs text-muted-foreground mb-1.5 font-semibold">
            MOTIVO (opcional)
          </label>
          <textarea
            id="motivo-baja"
            value={bajaMotivo}
            onChange={(e) => setBajaMotivo(e.target.value.slice(0, 500))}
            maxLength={500}
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-input-background border border-border-control text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </ConfirmarSheet>
    </div>
  )
}

function SectorChip({ sector }: { sector: SectorLista }) {
  const Icono = resolverIcono(sector.icono ?? '')
  return (
    <span className="inline-flex items-center gap-1">
      <Icono className="w-3.5 h-3.5" aria-hidden="true" />
      {sector.nombre}
    </span>
  )
}
