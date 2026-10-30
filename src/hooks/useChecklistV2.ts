// Checklist (M80) v2: cartera de clientes e instalaciones, catálogo versionado, visitas con
// revisión por documento, incidencias e importación. Todo vive en RPC `chk_*` (la BD ya está lista).
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface ChkEstado {
  consultoria: boolean
  rol: string
  es_admin: boolean
  puede_revisar: boolean
  es_cliente: boolean
  tiene_checklist_anterior: boolean
}

export type CatalogoEstado = 'sin_catalogo' | 'borrador' | 'aprobado'
export type Vigencia = 'vigente' | 'proximo' | 'vencido' | 'sin_dato'
export type Aplicabilidad = 'aplica' | 'no_aplica' | 'por_confirmar'
export type PrecisionRegistro = 'dia' | 'mes' | 'texto'

export interface ChkSector { clave: string; nombre: string; icono: string }

/** Subalcance de una instalación (ej. Irapuato → Cal Giant, Hortifrut). */
export interface ChkAlcance { id: string; nombre: string; activo: boolean }
export type Atribucion = 'alcance' | 'compartido' | 'compartido_por_confirmar'

export interface VisitaResumenCartera { id: string; fecha: string; asesor: string | null; tipo_cierre?: string | null; estado?: string }

export interface CarteraInstalacion {
  id: string
  nombre: string
  tipo: string | null
  sector_clave: string | null
  sector_nombre: string | null
  ubicacion: string | null
  activo: boolean
  linked_rancho_id: string | null
  linked_rancho_nombre: string | null
  comparte_datos: boolean
  umbral_vigencia_dias: number
  catalogo_estado: CatalogoEstado
  catalogo_version: number
  documentos: number
  por_confirmar: number
  incidencias_abiertas: number
  visita_en_curso: VisitaResumenCartera | null
  proxima_visita: VisitaResumenCartera | null
  ultima_visita: VisitaResumenCartera | null
}

export interface CarteraCliente {
  id: string
  nombre: string
  activo: boolean
  contacto: string | null
  notas: string | null
  linked_org_id: string | null
  linked_org_nombre: string | null
  instalaciones: CarteraInstalacion[]
}

export interface AlertaDoc { campo: string; mensaje: string }

export type ResultadoVerificacion = 'correcto' | 'incidencia' | 'pendiente' | 'no_aplica'

export interface Antecedente {
  fuente: 'visita' | 'checklist_anterior'
  fecha: string
  resultado?: ResultadoVerificacion
  actualizado?: boolean
  estado_anterior?: string
  observacion: string | null
  asesor: string | null
}

export interface ChkDocumento {
  id: string
  instalacion_id: string
  /** 1 = formatos codificados, 2 = controles complementarios (sin código), 3 = plantilla orgánica */
  seccion: number
  categoria: string | null
  /** Observación general: se muestra como antecedente, no se evalúa */
  es_nota: boolean
  /** null = documento compartido entre alcances */
  alcance_id: string | null
  atribucion_por_confirmar: boolean
  area: string | null
  tipo_doc: string | null
  revision: string | null
  numeral: string | null
  nombre: string
  codigo: string | null
  responsable_llenado: string | null
  frecuencia: string | null
  aplicabilidad: Aplicabilidad
  motivo_no_aplica: string | null
  ultimo_registro_fecha: string | null
  ultimo_registro_texto: string | null
  ultimo_registro_precision: PrecisionRegistro | null
  vence_el: string | null
  modulos_mady: string[] | null
  antecedentes: string | null
  alertas: AlertaDoc[]
  origen: string | null
  orden: number
  activo: boolean
  version: number
  vigencia: Vigencia
  antecedente: Antecedente | null
  incidencias_abiertas: number
}

export interface CatalogoVer {
  instalacion: {
    id: string; nombre: string; tipo: string | null; cliente: string
    sector_clave: string | null; sector_nombre: string | null
    catalogo_estado: CatalogoEstado; catalogo_version: number
    aprobado_en: string | null; aprobado_por: string | null; umbral_vigencia_dias: number
  }
  documentos: ChkDocumento[]
}

export interface Seguimiento { tipo: string; texto: string | null; cliente: boolean; actor?: string | null; fecha: string }

export type TipoVinculo = 'contexto' | 'parcial' | 'directo'
export type EstadoVinculo = 'sugerido' | 'confirmado' | 'descartado'
export interface VinculoDocRef { id: string; seccion: number; codigo: string | null; nombre: string }
export interface Vinculo {
  id: string; tipo: TipoVinculo; estado: EstadoVinculo; nota: string | null
  origen: VinculoDocRef; destino: VinculoDocRef
  decidido_por: string | null; decidido_en: string | null
}

export interface IncidenciaLista {
  id: string
  documento_id: string
  codigo: string | null
  documento: string
  area: string | null
  descripcion: string
  categoria: string | null
  estado: string
  responsable: string | null
  fecha_compromiso: string | null
  origen_fecha: string | null
  creado_en: string
  cerrada_en: string | null
  seguimientos: Seguimiento[]
}

export interface VisitaEvento {
  tipo: string; fecha_anterior: string | null; fecha_nueva: string | null
  motivo: string | null; actor: string | null; creado_en: string
}

export type EstadoVisita = 'programada' | 'en_curso' | 'cerrada' | 'cancelada' | 'realizada'

export interface ResumenVisita {
  aplicables: number; correctos: number; con_incidencia: number
  sin_revisar: number; actualizados: number; vencidos: number
  pendientes?: number; no_aplica?: number
}

/** Conteos por sección ("1", "2", "3" si el orgánico está activo). */
export interface ResumenSeccion {
  aplicables: number; correctos: number; actualizados: number; pendientes: number
  no_aplica: number; con_incidencia: number; sin_revisar: number
}
export type SeccionesResumen = Record<string, ResumenSeccion>

export interface VisitaLista {
  id: string
  fecha: string
  estado: EstadoVisita
  tipo_cierre: string | null
  asesor: string | null
  asesor_id: string | null
  nota: string | null
  alcance_id: string | null
  alcance: string | null
  organico_activo: boolean
  resumen: ResumenVisita | null
  eventos: VisitaEvento[]
}

export interface VerificacionDoc {
  resultado: ResultadoVerificacion
  actualizado: boolean
  cambios: Record<string, unknown> | null
  observacion: string | null
  incidencia_id: string | null
  actor: string | null
  creado_en: string
}

export interface IncidenciaDoc {
  id: string
  descripcion: string
  estado: string
  origen_fecha: string | null
  nueva: boolean
  responsable: string | null
  fecha_compromiso: string | null
  seguimientos: Seguimiento[]
}

/** Documento de otra tabla vinculado (y confirmado) con este: solo consulta. */
export interface DocRelacionado {
  id: string
  seccion: number
  codigo: string | null
  nombre: string
  tipo: 'contexto' | 'parcial' | 'directo'
  ultimo_registro: string | null
  verificacion_actual: { resultado: ResultadoVerificacion; creado_en: string } | null
  antecedente: Antecedente | null
}

export interface DocVisita extends Omit<ChkDocumento, 'alertas' | 'incidencias_abiertas'> {
  verificacion: VerificacionDoc | null
  incidencias: IncidenciaDoc[]
  /** false = documento de la Tabla 3 con la revisión orgánica apagada */
  habilitado: boolean
  atribucion: Atribucion
  relacionados: DocRelacionado[]
}

export interface NotaGeneral { id: string; seccion: number; nombre: string; antecedentes: string | null; atribucion: Atribucion }

export interface VisitaEnCurso {
  estado: EstadoVisita
  visita: { id: string; estado: EstadoVisita; fecha: string; asesor_id: string | null; asesor: string | null; nota: string | null; abierta_en: string | null; puede_capturar: boolean
    alcance_id: string | null; alcance: string | null; organico_activo: boolean; tiene_plantilla_organica: boolean
  }
  notas: NotaGeneral[]
  secciones: SeccionesResumen | null
  cliente: string
  instalacion: { id: string; nombre: string; tipo: string | null }
  documentos: DocVisita[]
  resumen: ResumenVisita | null
}

export interface ReporteDoc {
  documento_id: string
  seccion: number
  area: string | null
  tipo_doc: string | null
  revision: string | null
  numeral: string | null
  nombre: string
  codigo: string | null
  responsable_llenado: string | null
  ultimo_registro: string | null
  vence_el: string | null
  vigencia: Vigencia
  categoria?: string | null
  estado: 'sin_revisar' | ResultadoVerificacion
  actualizado: boolean
  cambios: Record<string, { antes?: unknown; despues?: unknown } | unknown>
  observacion: string | null
  revisado_por: string | null
  revisado_en: string | null
  incidencia: string | null
}

export interface ReporteIncidencia {
  id: string
  documento: string | null
  documento_nombre: string
  area: string | null
  descripcion: string
  estado: string
  nueva: boolean
  origen_fecha: string | null
  responsable: string | null
  fecha_compromiso: string | null
  ultimo_seguimiento: { tipo: string; texto: string | null; fecha: string; cliente: boolean } | null
}

export interface Reporte {
  consultoria: string
  cliente: string
  instalacion: string
  instalacion_tipo: string | null
  alcance?: string | null
  organico?: { activo: boolean; plantilla_disponible: boolean; leyenda: string | null }
  secciones?: SeccionesResumen
  notas?: { seccion: number; nombre: string; antecedentes: string | null }[]
  visita: {
    id: string; fecha: string; estado: string; asesor: string | null; abierta_en: string | null
    catalogo_version: number; tipo_cierre: 'completo' | 'parcial'
    justificacion_parcial?: string | null; observaciones_generales?: string | null; cerrada_en?: string | null; cerrada_por?: string | null
  }
  resumen: ResumenVisita
  documentos: ReporteDoc[]
  incidencias: ReporteIncidencia[]
  hash: string
  es_borrador?: boolean
}

export interface HistorialDoc {
  version: number; accion: string; cambios: Record<string, unknown> | null
  origen: string | null; visita_id: string | null; motivo: string | null
  actor: string | null; creado_en: string
}

export interface ImportacionLista {
  id: string; archivo_nombre: string; formato: string; estado: string
  total_filas: number; resumen: Record<string, number>; creado_en: string
  aplicada_en: string | null; creado_por: string | null
}

export type Clasificacion = 'nuevo' | 'modificado' | 'igual' | 'dudoso' | 'duplicado'

export interface ImportacionFila {
  id: string
  n_fila: number
  original: Record<string, unknown>
  datos: Record<string, unknown>
  clasificacion: Clasificacion
  documento_id: string | null
  documento_actual: Record<string, unknown> | null
  diferencias: Record<string, { antes: unknown; despues: unknown }>
  alertas: AlertaDoc[]
  decision: 'aplicar' | 'omitir' | null
  aplicado: boolean
}

export interface ImportacionVer {
  id: string; archivo_nombre: string; formato: string; estado: string
  total_filas: number; resumen: Record<string, number>
  filas: ImportacionFila[]
}

export interface PortalIncidencia {
  id: string; codigo: string | null; documento: string; area: string | null
  descripcion: string; estado: string; responsable: string | null
  fecha_compromiso: string | null; origen_fecha: string | null; seguimientos: Seguimiento[]
}
export interface PortalVisita { id: string; fecha: string; tipo_cierre: string | null; asesor: string | null; resumen: ResumenVisita | null }
export interface PortalConsultoria {
  consultoria: string
  instalaciones: { id: string; nombre: string; visitas: PortalVisita[]; incidencias: PortalIncidencia[] }[]
}

// ── RPC ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpcRaw = (name: string, params?: Record<string, unknown>) => (supabase as any).rpc(name, params)

/** "CODIGO: mensaje" → mensaje. */
export function mensajeError(e: unknown): string {
  const msg = (e as { message?: string } | null)?.message ?? 'No se pudo completar la acción. Intenta de nuevo.'
  const i = msg.indexOf(': ')
  return i > 0 && /^[A-Z_0-9]+$/.test(msg.slice(0, i)) ? msg.slice(i + 2) : msg
}
export function codigoError(e: unknown): string | null {
  const msg = (e as { message?: string } | null)?.message ?? ''
  const i = msg.indexOf(': ')
  return i > 0 && /^[A-Z_0-9]+$/.test(msg.slice(0, i)) ? msg.slice(0, i) : null
}

async function rpc<T>(name: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpcRaw(name, params)
  if (error) {
    console.error(`[checklist] ${name}`, error)
    throw error
  }
  return data as T
}

export const nuevoEventId = () => crypto.randomUUID()

export const chk = {
  estado: () => rpc<ChkEstado>('chk_estado'),
  cartera: () => rpc<CarteraCliente[]>('chk_cartera'),
  clienteGuardar: (p: { id?: string | null; nombre: string; linked_org?: string | null; contacto?: string | null; notas?: string | null; activo?: boolean }) =>
    rpc<string>('chk_cliente_guardar', {
      p_id: p.id ?? null, p_nombre: p.nombre, p_linked_org: p.linked_org ?? null,
      p_contacto: p.contacto ?? null, p_notas: p.notas ?? null, p_activo: p.activo ?? true,
    }),
  buscarOrganizaciones: (texto: string) => rpc<{ id: string; nombre: string }[]>('chk_buscar_organizaciones', { p_texto: texto }),
  sitiosCliente: (cliente: string) => rpc<{ id: string; nombre: string; org: 'propia' | 'cliente' }[]>('chk_sitios_cliente', { p_cliente: cliente }),
  instalacionGuardar: (p: {
    id?: string | null; cliente: string; nombre: string; tipo?: string | null; ubicacion?: string | null
    linked_rancho?: string | null; comparte_datos?: boolean; umbral?: number; activo?: boolean; sector?: string | null
  }) =>
    rpc<string>('chk_instalacion_guardar', {
      p_id: p.id ?? null, p_cliente: p.cliente, p_nombre: p.nombre, p_tipo: p.tipo ?? null, p_ubicacion: p.ubicacion ?? null,
      p_linked_rancho: p.linked_rancho ?? null, p_comparte_datos: p.comparte_datos ?? false,
      p_umbral_vigencia_dias: p.umbral ?? 30, p_activo: p.activo ?? true, p_sector: p.sector ?? null,
    }),
  sectores: () => rpc<ChkSector[]>('chk_sectores'),
  catalogoPrecargar: (instalacion: string, sector: string) =>
    rpc<{ sector: string; agregados: number }>('chk_catalogo_precargar', { p_instalacion: instalacion, p_sector: sector }),

  catalogoVer: (instalacion: string) => rpc<CatalogoVer>('chk_catalogo_ver', { p_instalacion: instalacion }),
  documentoGuardar: (p: { id?: string | null; instalacion: string; datos: Record<string, unknown>; motivo?: string | null }) =>
    rpc<unknown>('chk_documento_guardar', { p_id: p.id ?? null, p_instalacion: p.instalacion, p_datos: p.datos, p_motivo: p.motivo ?? null }),
  documentoBaja: (id: string, activo: boolean, motivo: string | null) =>
    rpc<unknown>('chk_documento_baja', { p_id: id, p_activo: activo, p_motivo: motivo }),
  aplicabilidad: (instalacion: string, ids: string[], aplicabilidad: Aplicabilidad, motivo: string | null) =>
    rpc<unknown>('chk_documentos_aplicabilidad', { p_instalacion: instalacion, p_ids: ids, p_aplicabilidad: aplicabilidad, p_motivo: motivo }),
  documentoValidar: (id: string, nota: string | null) => rpc<unknown>('chk_documento_validar', { p_id: id, p_nota: nota }),
  documentoHistorial: (id: string) => rpc<HistorialDoc[]>('chk_documento_historial_ver', { p_documento: id }),
  catalogoAprobar: (instalacion: string, notas: string | null) =>
    rpc<unknown>('chk_catalogo_aprobar', { p_instalacion: instalacion, p_notas: notas }),

  importacionCrear: (p: { instalacion: string; nombre: string; hash: string; formato: 'pdf' | 'docx'; filas: unknown[] }) =>
    rpc<{ importacion_id: string; resumen: Record<string, number> }>('chk_importacion_crear', {
      p_instalacion: p.instalacion, p_archivo_nombre: p.nombre, p_archivo_hash: p.hash, p_formato: p.formato, p_filas: p.filas,
    }),
  importacionVer: (id: string) => rpc<ImportacionVer>('chk_importacion_ver', { p_importacion: id }),
  importaciones: (instalacion: string) => rpc<ImportacionLista[]>('chk_importaciones_lista', { p_instalacion: instalacion }),
  importacionDecidir: (fila: string, decision: 'aplicar' | 'omitir', datos: Record<string, unknown> | null, alertasResueltas: boolean) =>
    rpc<unknown>('chk_importacion_decidir', { p_fila: fila, p_decision: decision, p_datos: datos, p_alertas_resueltas: alertasResueltas }),
  importacionAplicar: (id: string) => rpc<{ altas: number; modificados: number }>('chk_importacion_aplicar', { p_importacion: id }),
  importacionCancelar: (id: string) => rpc<unknown>('chk_importacion_cancelar', { p_importacion: id }),

  alcancesLista: (instalacion: string) => rpc<ChkAlcance[]>('chk_alcances_lista', { p_instalacion: instalacion }),
  alcanceGuardar: (p: { id?: string | null; instalacion: string; nombre: string; activo?: boolean }) =>
    rpc<unknown>('chk_alcance_guardar', { p_id: p.id ?? null, p_instalacion: p.instalacion, p_nombre: p.nombre, p_activo: p.activo ?? true }),

  visProgramar: (p: { instalacion: string; fecha: string; asesor: string | null; nota: string | null; alcance?: string | null; eventId: string }) =>
    rpc<unknown>('chk_vis_programar', {
      p_instalacion: p.instalacion, p_fecha: p.fecha, p_asesor: p.asesor, p_nota: p.nota, p_event_id: p.eventId, p_alcance: p.alcance ?? null,
    }),
  visReprogramar: (p: { visita: string; fecha: string; asesor: string | null; motivo: string; eventId: string }) =>
    rpc<unknown>('chk_vis_reprogramar', { p_visita: p.visita, p_fecha: p.fecha, p_asesor: p.asesor, p_motivo: p.motivo, p_event_id: p.eventId }),
  visCancelar: (p: { visita: string; motivo: string; eventId: string }) =>
    rpc<unknown>('chk_vis_cancelar', { p_visita: p.visita, p_motivo: p.motivo, p_event_id: p.eventId }),
  visLista: (instalacion: string) => rpc<VisitaLista[]>('chk_vis_lista', { p_instalacion: instalacion }),
  vinculosLista: (instalacion: string, estado: EstadoVinculo | null) =>
    rpc<Vinculo[]>('chk_vinculos_lista', { p_instalacion: instalacion, p_estado: estado }),
  vinculoGuardar: (p: { origen: string; destino: string; tipo: TipoVinculo; estado: EstadoVinculo; nota?: string | null }) =>
    rpc<unknown>('chk_vinculo_guardar', { p_origen: p.origen, p_destino: p.destino, p_tipo: p.tipo, p_estado: p.estado, p_nota: p.nota ?? null }),

  visOrganico: (p: { visita: string; activo: boolean; motivo?: string | null; eventId: string }) =>
    rpc<{ organico_activo: boolean; avances?: number; sin_cambios?: boolean }>('chk_vis_organico', {
      p_visita: p.visita, p_activo: p.activo, p_motivo: p.motivo ?? null, p_event_id: p.eventId,
    }),
  docMarcar: (p: { visita: string; documento: string; resultado: 'pendiente' | 'no_aplica'; observacion: string | null; eventId: string }) =>
    rpc<unknown>('chk_doc_marcar', { p_visita: p.visita, p_documento: p.documento, p_resultado: p.resultado, p_observacion: p.observacion, p_event_id: p.eventId }),
  visAbrir: (visita: string, eventId: string) => rpc<unknown>('chk_vis_abrir', { p_visita: visita, p_event_id: eventId }),
  visVer: (visita: string) => rpc<VisitaEnCurso | { estado: 'cerrada'; reporte: Reporte }>('chk_vis_ver', { p_visita: visita }),
  docConfirmar: (p: { visita: string; documento: string; observacion: string | null; eventId: string }) =>
    rpc<unknown>('chk_doc_confirmar', { p_visita: p.visita, p_documento: p.documento, p_observacion: p.observacion, p_event_id: p.eventId }),
  docActualizar: (p: { visita: string; documento: string; cambios: Record<string, unknown>; observacion: string | null; eventId: string }) =>
    rpc<unknown>('chk_doc_actualizar', { p_visita: p.visita, p_documento: p.documento, p_cambios: p.cambios, p_observacion: p.observacion, p_event_id: p.eventId }),
  incidenciaRegistrar: (p: {
    visita: string; documento: string; descripcion: string; categoria?: string | null
    responsable?: string | null; fechaCompromiso?: string | null; eventId: string
  }) =>
    rpc<unknown>('chk_incidencia_registrar', {
      p_visita: p.visita, p_documento: p.documento, p_descripcion: p.descripcion, p_categoria: p.categoria ?? null,
      p_responsable: p.responsable ?? null, p_fecha_compromiso: p.fechaCompromiso ?? null, p_event_id: p.eventId,
    }),
  incidenciaSeguir: (p: {
    incidencia: string; tipo: 'seguimiento' | 'correccion_reportada' | 'correccion_rechazada' | 'cierre'
    texto: string | null; visita?: string | null; eventId: string
  }) =>
    rpc<unknown>('chk_incidencia_seguir', {
      p_incidencia: p.incidencia, p_tipo: p.tipo, p_texto: p.texto, p_visita: p.visita ?? null, p_event_id: p.eventId,
    }),
  incidencias: (instalacion: string, soloAbiertas: boolean) =>
    rpc<IncidenciaLista[]>('chk_incidencias_lista', { p_instalacion: instalacion, p_solo_abiertas: soloAbiertas }),
  visPreview: (visita: string) => rpc<Reporte>('chk_vis_preview', { p_visita: visita }),
  visCerrar: (p: { visita: string; justificacion: string | null; observaciones: string | null; hash: string; eventId: string }) =>
    rpc<unknown>('chk_vis_cerrar', {
      p_visita: p.visita, p_justificacion: p.justificacion, p_observaciones: p.observaciones, p_preview_hash: p.hash, p_event_id: p.eventId,
    }),
  visReporte: (visita: string) => rpc<Reporte>('chk_vis_reporte', { p_visita: visita }),

  clientePortal: () => rpc<PortalConsultoria[]>('chk_cliente_portal'),
  clienteReportar: (incidencia: string, texto: string, eventId: string) =>
    rpc<unknown>('chk_cliente_reportar_correccion', { p_incidencia: incidencia, p_texto: texto, p_event_id: eventId }),
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export interface Carga<T> {
  data: T | null
  loading: boolean
  error: string | null
  recargar: () => Promise<void>
  setData: (d: T | null) => void
}

/** Carga una RPC de lectura al montar (y cuando cambia `clave`); `null` en clave = no cargar. */
let sectoresCache: ChkSector[] | null = null

/** Sectores para mostrar el ícono de cada instalación; se piden una sola vez por sesión. */
export function useSectoresChk(): ChkSector[] {
  const [sectores, setSectores] = useState<ChkSector[]>(sectoresCache ?? [])
  useEffect(() => {
    if (sectoresCache) return
    chk.sectores().then(s => { sectoresCache = s ?? []; setSectores(sectoresCache) }).catch(() => { /* el ícono es decorativo */ })
  }, [])
  return sectores
}

export function useCarga<T>(clave: string | null, fn: () => Promise<T>): Carga<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(clave !== null)
  const [error, setError] = useState<string | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const seq = useRef(0)

  const recargar = useCallback(async () => {
    if (clave === null) return
    const mi = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const r = await fnRef.current()
      if (mi === seq.current) setData(r)
    } catch (e) {
      if (mi === seq.current) setError(mensajeError(e))
    } finally {
      if (mi === seq.current) setLoading(false)
    }
  }, [clave])

  useEffect(() => {
    setData(null)
    if (clave !== null) void recargar()
    else setLoading(false)
  }, [clave, recargar])

  return { data, loading, error, recargar, setData }
}

/** Ejecuta una acción de escritura con event_id único por intento (se reutiliza si se reintenta). */
export function useAccion() {
  const [ocupado, setOcupado] = useState(false)
  const eventId = useRef<string | null>(null)
  const ejecutar = useCallback(async <T,>(fn: (eventId: string) => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: unknown; mensaje: string }> => {
    if (!eventId.current) eventId.current = nuevoEventId()
    setOcupado(true)
    try {
      const data = await fn(eventId.current)
      eventId.current = null
      return { ok: true, data }
    } catch (e) {
      // Error de red: se conserva el event_id para reintentar de forma idempotente
      if (codigoError(e)) eventId.current = null
      return { ok: false, error: e, mensaje: mensajeError(e) }
    } finally {
      setOcupado(false)
    }
  }, [])
  const reiniciar = useCallback(() => { eventId.current = null }, [])
  return { ocupado, ejecutar, reiniciar }
}

// ── ¿Es cliente ligado de una consultoría? ───────────────────────────────────
// Lo usan el menú (Layout) y la guarda de módulos (RequireModulo): el cliente ve el Checklist aunque
// su organización no tenga M80 desbloqueado. Una sola llamada por sesión de usuario.
let cacheCliente: { uid: string; promesa: Promise<boolean> } | null = null

export function useChkEsCliente(uid: string | undefined, habilitado: boolean): { esCliente: boolean; listo: boolean } {
  const [estado, setEstado] = useState<{ esCliente: boolean; listo: boolean }>({ esCliente: false, listo: !habilitado })
  useEffect(() => {
    if (!habilitado || !uid) { setEstado({ esCliente: false, listo: true }); return }
    if (!cacheCliente || cacheCliente.uid !== uid) {
      cacheCliente = {
        uid,
        promesa: chk.estado().then(e => !!e?.es_cliente).catch(e => { console.error('[checklist] es_cliente', e); cacheCliente = null; return false }),
      }
    }
    let vivo = true
    cacheCliente.promesa.then(esCliente => { if (vivo) setEstado({ esCliente, listo: true }) })
    return () => { vivo = false }
  }, [uid, habilitado])
  return estado
}
