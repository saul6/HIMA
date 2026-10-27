import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { crearErrorNomina } from '@/lib/nomina/errores'
import type {
  MiVoucher, NomActividad, NomActividadCatalogo, NomAjuste, NomAsistencia, NomConcepto, NomConfig,
  NomMovimiento, NomPagoFila, NomPerfilPago, NomPrestamo, NomPrestamoMov, NomTarifa, NomTrabajador,
  RespuestaCalculo, SemanaResumen, VoucherData,
} from '@/types/nomina.types'

// ───────────── RPC (toda escritura pasa por aquí; nunca se manda org_id) ─────────────

/** Llama una RPC nom_* y, si falla, lanza un error con `.codigo` y el mensaje ya en español. */
async function rpc<T = unknown>(nombre: string, args: Record<string, unknown> = {}): Promise<T> {
  // Se quitan los undefined; los null sí se envían (significan "vacío" para la BD).
  const limpio = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined))
  const { data, error } = await (supabase.rpc as unknown as (
    n: string, a: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>)(nombre, limpio)
  if (error) throw crearErrorNomina(error)
  return data as T
}

export const nuevoIdOperacion = () => crypto.randomUUID()

export interface ResultadoActividad { id: string; version: number; duplicada?: boolean; periodo_id?: string }
export interface ResultadoPago { pago_id: string; repetida: boolean; pago?: unknown }

export const nomina = {
  // catálogos
  guardarTrabajador: (a: {
    id: string | null; codigo: string; nombre: string; puesto: string | null; profileId: string | null
    m77EmpleadoId: string | null; activo: boolean; fechaAlta: string | null; fechaBaja: string | null; notas: string | null
  }) => rpc<string>('nom_guardar_trabajador', {
    p_id: a.id, p_codigo: a.codigo, p_nombre: a.nombre, p_puesto: a.puesto, p_profile_id: a.profileId,
    p_m77_empleado_id: a.m77EmpleadoId, p_activo: a.activo, p_fecha_alta: a.fechaAlta, p_fecha_baja: a.fechaBaja,
    p_notas: a.notas,
  }),
  fijarPerfilPago: (a: {
    trabajador: string; modalidad: string; sueldoSemanal: number | null; tarifaJornada: number | null
    tarifaHora: number | null; desde: string; motivo: string | null
  }) => rpc<string>('nom_fijar_perfil_pago', {
    p_trabajador: a.trabajador, p_modalidad: a.modalidad, p_sueldo_semanal: a.sueldoSemanal,
    p_tarifa_jornada: a.tarifaJornada, p_tarifa_hora: a.tarifaHora, p_desde: a.desde, p_motivo: a.motivo,
  }),
  guardarActividadCatalogo: (a: {
    id: string | null; nombre: string; modo: string; unidad: string; codigo: string | null
    categoria: string | null; sinonimos: string[]; orden: number; archivada: boolean
  }) => rpc<string>('nom_guardar_actividad_catalogo', {
    p_id: a.id, p_nombre: a.nombre, p_modo: a.modo, p_unidad: a.unidad, p_codigo: a.codigo,
    p_categoria: a.categoria, p_sinonimos: a.sinonimos, p_orden: a.orden, p_archivada: a.archivada,
  }),
  fijarTarifa: (a: { actividad: string; monto: number | null; trabajador: string | null; desde: string; motivo: string | null }) =>
    rpc<string>('nom_fijar_tarifa', {
      p_actividad: a.actividad, p_monto: a.monto, p_trabajador: a.trabajador, p_desde: a.desde, p_motivo: a.motivo,
    }),
  guardarConcepto: (a: { id: string | null; nombre: string; tipo: string; clave: string | null; archivado: boolean }) =>
    rpc<string>('nom_guardar_concepto', {
      p_id: a.id, p_nombre: a.nombre, p_tipo: a.tipo, p_clave: a.clave, p_archivado: a.archivado,
    }),
  prestamoCuota: (prestamo: string, cuota: number | null) =>
    rpc<unknown>('nom_prestamo_cuota', { p_prestamo: prestamo, p_cuota: cuota }),

  // captura
  registrarActividad: (a: {
    trabajador: string; fecha: string; actividad: string; clientOperationId: string; cantidad: number
    importePactado: number | null; motivoPactado: string | null; ranchoId: string | null; nota: string | null
  }) => rpc<ResultadoActividad>('nom_registrar_actividad', {
    p_trabajador: a.trabajador, p_fecha: a.fecha, p_actividad: a.actividad, p_client_operation_id: a.clientOperationId,
    p_cantidad: a.cantidad, p_importe_pactado: a.importePactado, p_motivo_pactado: a.motivoPactado,
    p_rancho_id: a.ranchoId, p_nota: a.nota,
  }),
  editarActividad: (a: {
    id: string; version: number; fecha: string; actividad: string; cantidad: number
    importePactado: number | null; motivoPactado: string | null; ranchoId: string | null; nota: string | null
  }) => rpc<ResultadoActividad>('nom_editar_actividad', {
    p_id: a.id, p_expected_version: a.version, p_fecha: a.fecha, p_actividad: a.actividad, p_cantidad: a.cantidad,
    p_importe_pactado: a.importePactado, p_motivo_pactado: a.motivoPactado, p_rancho_id: a.ranchoId, p_nota: a.nota,
  }),
  anularActividad: (id: string, version: number, motivo: string) =>
    rpc<unknown>('nom_anular_actividad', { p_id: id, p_expected_version: version, p_motivo: motivo }),
  marcarAsistencia: (trabajador: string, fecha: string, estado: string | null, horas: number | null, nota: string | null = null) =>
    rpc<unknown>('nom_marcar_asistencia', {
      p_trabajador: trabajador, p_fecha: fecha, p_estado: estado, p_horas: horas, p_nota: nota,
    }),
  agregarMovimiento: (a: {
    trabajador: string; fecha: string; concepto: string; monto: number; motivo: string; clientOperationId: string
  }) => rpc<string>('nom_agregar_movimiento', {
    p_trabajador: a.trabajador, p_fecha: a.fecha, p_concepto: a.concepto, p_monto: a.monto, p_motivo: a.motivo,
    p_client_operation_id: a.clientOperationId,
  }),
  anularMovimiento: (id: string) => rpc<unknown>('nom_anular_movimiento', { p_id: id }),

  // corte y dinero
  semana: (fecha: string) => rpc<SemanaResumen>('nom_semana', { p_fecha: fecha }),
  calcularCorte: (trabajador: string, fecha: string) =>
    rpc<RespuestaCalculo>('nom_calcular_corte', { p_trabajador: trabajador, p_fecha: fecha }),
  aprobarCorte: (trabajador: string, periodo: string, hash: string, llave: string) =>
    rpc<{ corte_id: string; folio: string | number; repetida: boolean; prestamo_exceso_id: string | null; pago: unknown }>(
      'nom_aprobar_corte',
      { p_trabajador: trabajador, p_periodo: periodo, p_expected_hash: hash, p_idempotency_key: llave },
    ),
  anularCorte: (corte: string, motivo: string) => rpc<unknown>('nom_anular_corte', { p_corte: corte, p_motivo: motivo }),
  registrarPago: (a: { corte: string; monto: number; metodo: string; fechaPago: string; llave: string; referencia: string | null }) =>
    rpc<ResultadoPago>('nom_registrar_pago', {
      p_corte: a.corte, p_monto: a.monto, p_metodo: a.metodo, p_fecha_pago: a.fechaPago,
      p_idempotency_key: a.llave, p_referencia: a.referencia,
    }),
  registrarAnticipo: (a: {
    trabajador: string; fechaSemana: string; monto: number; metodo: string; fechaPago: string; llave: string; referencia: string | null
  }) => rpc<ResultadoPago & { periodo_id: string }>('nom_registrar_anticipo', {
    p_trabajador: a.trabajador, p_fecha_semana: a.fechaSemana, p_monto: a.monto, p_metodo: a.metodo,
    p_fecha_pago: a.fechaPago, p_idempotency_key: a.llave, p_referencia: a.referencia,
  }),
  revertirPago: (a: { pago: string; monto: number; motivo: string; llave: string }) =>
    rpc<ResultadoPago>('nom_revertir_pago', {
      p_pago: a.pago, p_monto: a.monto, p_motivo: a.motivo, p_idempotency_key: a.llave,
    }),
  crearAjuste: (a: { corteOrigen: string; tipo: 'a_favor' | 'en_contra'; monto: number; motivo: string; llave: string }) =>
    rpc<string>('nom_crear_ajuste', {
      p_corte_origen: a.corteOrigen, p_tipo: a.tipo, p_monto: a.monto, p_motivo: a.motivo, p_idempotency_key: a.llave,
    }),
  cancelarAjuste: (id: string, motivo: string) => rpc<unknown>('nom_cancelar_ajuste', { p_id: id, p_motivo: motivo }),
  voucher: (corte: string) => rpc<VoucherData>('nom_voucher', { p_corte: corte }),
  misVouchers: () => rpc<MiVoucher[]>('nom_mis_vouchers'),
}

// ───────────── Lecturas directas de tablas (RLS: solo admin de la org) ─────────────

type Fila = Record<string, unknown>

async function leer<T>(tabla: string, org: string, ajustar?: (q: any) => any): Promise<T[]> {
  let q: any = (supabase.from as unknown as (t: string) => any)(tabla).select('*').eq('org_id', org)
  if (ajustar) q = ajustar(q)
  const { data, error } = await q
  if (error) throw crearErrorNomina(error)
  return (data ?? []) as T[]
}

interface Carga<T> {
  datos: T
  cargando: boolean
  error: string | null
  recargar: () => Promise<void>
}

/** Carga genérica: vuelve a pedir cuando cambian `deps`; ignora respuestas viejas. */
function useCarga<T>(inicial: T, fn: () => Promise<T>, deps: unknown[], activo = true): Carga<T> {
  const [datos, setDatos] = useState<T>(inicial)
  const [cargando, setCargando] = useState(activo)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const recargar = useCallback(async () => {
    if (!activo) { setCargando(false); return }
    const mi = ++seq.current
    setCargando(true)
    try {
      const d = await fnRef.current()
      if (mi === seq.current) { setDatos(d); setError(null) }
    } catch (e) {
      if (mi === seq.current) setError(e instanceof Error ? e.message : 'No se pudo cargar')
    } finally {
      if (mi === seq.current) setCargando(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, ...deps])

  useEffect(() => { void recargar() }, [recargar])
  return { datos, cargando, error, recargar }
}

/** ¿El usuario tiene M81 en su menú? (get_mis_modulos solo lo devuelve a admins de orgs habilitadas). */
export function useTieneNomina(): { tiene: boolean; cargando: boolean } {
  const { modulos, loading } = useModulosContext()
  // Antes de la primera carga `modulos` viene vacío: se espera en vez de redirigir.
  return { tiene: modulos.some(m => m.codigo === 'M81'), cargando: loading || modulos.length === 0 }
}

export function useNomConfig() {
  const { profile } = useAuthContext()
  const org = profile?.org_id ?? null
  return useCarga<NomConfig | null>(null, async () => (await leer<NomConfig>('nom_config', org!))[0] ?? null, [org], !!org)
}

export function useNomSemana(fecha: string) {
  const { profile } = useAuthContext()
  const org = profile?.org_id ?? null
  return useCarga<SemanaResumen | null>(null, () => nomina.semana(fecha), [fecha, org], !!org)
}

export function useNomTrabajadores() {
  const { profile } = useAuthContext()
  const org = profile?.org_id ?? null
  return useCarga<NomTrabajador[]>([], () =>
    leer<NomTrabajador>('nom_trabajadores', org!, q => q.order('nombre')), [org], !!org)
}

export function useNomPerfilesPago(trabajadorId?: string) {
  const { profile } = useAuthContext()
  const org = profile?.org_id ?? null
  return useCarga<NomPerfilPago[]>([], () =>
    leer<NomPerfilPago>('nom_perfiles_pago', org!, q => {
      const r = trabajadorId ? q.eq('trabajador_id', trabajadorId) : q
      return r.order('vigente_desde', { ascending: false })
    }), [org, trabajadorId], !!org)
}

export function useNomActividadesCatalogo() {
  const { profile } = useAuthContext()
  const org = profile?.org_id ?? null
  return useCarga<NomActividadCatalogo[]>([], () =>
    leer<NomActividadCatalogo>('nom_actividades_catalogo', org!, q => q.order('orden').order('nombre')), [org], !!org)
}

export function useNomTarifas() {
  const { profile } = useAuthContext()
  const org = profile?.org_id ?? null
  return useCarga<NomTarifa[]>([], () =>
    leer<NomTarifa>('nom_tarifas', org!, q => q.order('vigente_desde', { ascending: false })), [org], !!org)
}

export function useNomConceptos() {
  const { profile } = useAuthContext()
  const org = profile?.org_id ?? null
  return useCarga<NomConcepto[]>([], () =>
    leer<NomConcepto>('nom_conceptos', org!, q => q.order('orden').order('nombre')), [org], !!org)
}

export interface CapturaSemana {
  actividades: NomActividad[]
  asistencia: NomAsistencia[]
  movimientos: NomMovimiento[]
  anticipos: NomPagoFila[]
  ajustes: NomAjuste[]
}
const CAPTURA_VACIA: CapturaSemana = { actividades: [], asistencia: [], movimientos: [], anticipos: [], ajustes: [] }

/** Captura de un trabajador en un periodo (actividades vigentes, asistencia, movimientos, anticipos y ajustes). */
export function useNomCaptura(trabajadorId: string, periodoId: string | null) {
  const { profile } = useAuthContext()
  const org = profile?.org_id ?? null
  return useCarga<CapturaSemana>(CAPTURA_VACIA, async () => {
    if (!periodoId) return CAPTURA_VACIA
    const filtro = (q: any) => q.eq('trabajador_id', trabajadorId).eq('periodo_id', periodoId)
    const [actividades, asistencia, movimientos, pagos, ajustes] = await Promise.all([
      leer<NomActividad>('nom_actividades', org!, q => filtro(q).neq('estado', 'anulada').order('fecha')),
      leer<NomAsistencia>('nom_asistencia', org!, q => filtro(q).order('fecha')),
      leer<NomMovimiento>('nom_movimientos', org!, q => filtro(q).neq('estado', 'anulado').order('created_at')),
      leer<NomPagoFila & Fila>('nom_pagos', org!, q => filtro(q).order('created_at')),
      leer<NomAjuste>('nom_ajustes', org!, q => q.eq('trabajador_id', trabajadorId).in('estado', ['pendiente', 'aplicado'])),
    ])
    return { actividades, asistencia, movimientos, anticipos: pagos.filter(p => p.tipo !== 'pago'), ajustes }
  }, [org, trabajadorId, periodoId], !!org)
}

export function useNomCalculo(trabajadorId: string, fecha: string) {
  const { profile } = useAuthContext()
  const org = profile?.org_id ?? null
  return useCarga<RespuestaCalculo | null>(null, () => nomina.calcularCorte(trabajadorId, fecha), [org, trabajadorId, fecha], !!org)
}

export interface PrestamoConSaldo extends NomPrestamo { saldo: number }

export function useNomPrestamos(trabajadorId: string) {
  const { profile } = useAuthContext()
  const org = profile?.org_id ?? null
  return useCarga<PrestamoConSaldo[]>([], async () => {
    const prestamos = await leer<NomPrestamo>('nom_prestamos', org!, q => q.eq('trabajador_id', trabajadorId))
    if (prestamos.length === 0) return []
    const ids = prestamos.map(p => p.id)
    const movs = await leer<NomPrestamoMov>('nom_prestamo_movs', org!, q => q.in('prestamo_id', ids))
    // saldo = suma de `monto` (viene del servidor con su signo)
    return prestamos
      .map(p => ({ ...p, saldo: movs.filter(m => m.prestamo_id === p.id).reduce((s, m) => s + Number(m.monto), 0) }))
      .filter(p => p.estado === 'activo' || p.saldo !== 0)
  }, [org, trabajadorId], !!org)
}

/** Usuarios activos de la org para ligar a un trabajador. */
export function useNomUsuariosOrg() {
  const { profile } = useAuthContext()
  const org = profile?.org_id ?? null
  return useCarga<{ id: string; nombre_completo: string | null }[]>([], async () => {
    const { data, error } = await supabase.from('profiles').select('id, nombre_completo').eq('org_id', org!).eq('activo', true)
    if (error) throw crearErrorNomina(error)
    return (data ?? []) as { id: string; nombre_completo: string | null }[]
  }, [org], !!org)
}

/** "Mis vouchers": vacío si el usuario no está ligado a un trabajador. */
export function useMisVouchers() {
  const { profile } = useAuthContext()
  return useCarga<MiVoucher[]>([], () => nomina.misVouchers(), [profile?.id], !!profile?.id)
}
