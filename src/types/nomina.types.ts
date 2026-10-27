// Tipos del módulo M81 "Actividades y pagos" (tablas nom_* y RPC). Escritura solo por RPC.
// Fuente de verdad: la BD. Actualizar si cambia el esquema.

export type ModalidadPago = 'fijo' | 'jornada' | 'hora' | 'ninguna'
export type ModoActividad = 'cantidad' | 'importe_pactado' | 'informativa'
export type TipoConcepto = 'percepcion' | 'deduccion' | 'reembolso' | 'memo'
export type EstadoAsistencia = 'trabajado' | 'medio' | 'ausente' | 'descanso' | 'permiso_pagado'
export type MetodoPago = 'efectivo' | 'transferencia' | 'deposito' | 'cheque' | 'vale' | 'otro'
export type TipoLinea = 'percepcion' | 'deduccion' | 'reembolso' | 'informativa'
export type OrigenTarifa = 'perfil' | 'trabajador' | 'organizacion' | 'pactado'
export type TipoPago = 'pago' | 'anticipo' | 'reversion'

export interface NomConfig {
  org_id: string
  habilitado: boolean
  fecha_arranque: string
  zona_horaria: string
  moneda: string
  semana_inicia: number
}

export interface NomTrabajador {
  id: string
  org_id: string
  codigo: string
  nombre: string
  puesto: string | null
  profile_id: string | null
  m77_empleado_id: string | null
  activo: boolean
  solo_historico: boolean
  fecha_alta: string
  fecha_baja: string | null
  notas: string | null
}

export interface NomPerfilPago {
  id: string
  trabajador_id: string
  modalidad: ModalidadPago
  sueldo_semanal: number | null
  tarifa_jornada: number | null
  tarifa_hora: number | null
  vigente_desde: string
  vigente_hasta: string | null
  motivo: string | null
}

export interface NomActividadCatalogo {
  id: string
  codigo: string | null
  nombre: string
  categoria: string | null
  unidad: string
  modo: ModoActividad
  sinonimos: string[]
  orden: number
  archivada: boolean
}

export interface NomTarifa {
  id: string
  actividad_id: string
  trabajador_id: string | null
  monto: number
  vigente_desde: string
  vigente_hasta: string | null
  motivo: string | null
}

export interface NomConcepto {
  id: string
  clave: string
  nombre: string
  tipo: TipoConcepto
  sistema: boolean
  archivado: boolean
  orden: number
}

export interface NomPeriodo {
  id: string
  inicio: string
  fin_excl: string
  estado: string
}

export interface NomActividad {
  id: string
  trabajador_id: string
  periodo_id: string
  fecha: string
  actividad_id: string
  cantidad: number
  importe_pactado: number | null
  motivo_pactado: string | null
  rancho_id: string | null
  nota: string | null
  estado: string
  version: number
}

export interface NomAsistencia {
  id: string
  trabajador_id: string
  periodo_id: string
  fecha: string
  estado: EstadoAsistencia
  horas: number | null
  nota: string | null
}

export interface NomMovimiento {
  id: string
  trabajador_id: string
  periodo_id: string
  concepto_id: string
  monto: number
  motivo: string
  estado: string
}

export interface NomPrestamo {
  id: string
  trabajador_id: string
  origen: string
  monto_original: number
  cuota_semanal: number | null
  estado: string
  nota: string | null
  created_at: string
}

export interface NomPrestamoMov {
  id: string
  prestamo_id: string
  tipo: string
  monto: number
}

export interface NomAjuste {
  id: string
  trabajador_id: string
  corte_origen_id: string
  tipo: 'a_favor' | 'en_contra'
  monto: number
  motivo: string
  estado: string
  corte_destino_id: string | null
}

export interface NomPagoFila {
  id: string
  tipo: TipoPago
  monto: number
  metodo: MetodoPago | null
  referencia: string | null
  fecha_pago: string
  revierte_pago_id: string | null
  motivo: string | null
  registrado_en: string
}

// ---- Respuestas de RPC ----
export type EstadoPagoCorte = 'pendiente' | 'parcial' | 'pagado' | string

export interface PagoResumen {
  neto: number
  entregado: number
  pendiente: number
  exceso_anticipo: number
  estado_pago: EstadoPagoCorte
}

export interface SemanaTrabajador {
  trabajador_id: string
  codigo: string
  nombre: string
  puesto?: string | null
  estado: 'borrador' | 'aprobado'
  neto: number
  // borrador
  anticipos?: number
  pendiente_estimado?: number
  exceso_anticipo?: number
  bloqueos?: number
  avisos?: number
  lineas?: number
  // aprobado
  corte_id?: string
  folio?: number | string
  pago?: PagoResumen
  [k: string]: unknown
}

export interface SemanaResumen {
  periodo: { id: string | null; inicio: string; fin: string; estado: string }
  fecha_arranque: string
  moneda: string
  trabajadores: SemanaTrabajador[]
  totales: { aprobados: number; borradores: number; neto_aprobado: number; pendiente_pago: number }
}

export interface LineaCorte {
  orden: number
  tipo: TipoLinea
  concepto: string
  fuente_tipo: string
  fuente_id: string | null
  fecha: string | null
  cantidad: number | null
  unidad: string | null
  tarifa: number | null
  origen_tarifa: OrigenTarifa | null
  formula: string | null
  monto: number
}

export interface BloqueoCorte { codigo: string; mensaje: string; fuente_id?: string | null }
export interface AvisoCorte { codigo: string; mensaje: string; rojo?: boolean; fechas?: string[]; monto?: number }

export interface CalculoCorte {
  trabajador: { id: string; nombre: string; codigo: string; puesto?: string | null }
  periodo: { inicio: string; fin: string }
  moneda: string
  lineas: LineaCorte[]
  totales: { percepciones: number; reembolsos: number; deducciones: number; neto: number }
  anticipos_sin_aplicar: number
  exceso_anticipo: number
  pendiente_estimado: number
  sin_importe: number
  bloqueos: BloqueoCorte[]
  avisos: AvisoCorte[]
  input_hash: string
}

export interface CorteAprobado {
  id: string
  folio: number | string
  estado: string
  aprobado_en: string
  aprobado_por: string | null
  calculo: CalculoCorte
  pago: PagoResumen
  pagos: NomPagoFila[]
}

export type RespuestaCalculo =
  | { aprobado: false; periodo_id: string | null; calculo: CalculoCorte }
  | { aprobado: true; periodo_id: string; corte: CorteAprobado }

export interface VoucherData {
  organizacion: string
  folio: string
  revision: number
  emitido_en: string
  estado_corte: string
  aprobado_en: string | null
  trabajador: { nombre: string; codigo: string; puesto?: string | null }
  periodo: { inicio: string; fin: string }
  moneda: string
  lineas: LineaCorte[]
  totales: { percepciones: number; reembolsos: number; deducciones: number; neto: number }
  pago: PagoResumen
  pagos: NomPagoFila[]
  prestamos_activos: { id: string; origen: string; saldo: number }[]
}

export interface MiVoucher {
  corte_id: string
  folio: string
  inicio: string
  fin: string
  neto: number
  pago: PagoResumen
}

// ───────────── Consolidado mensual (nom_consolidado_mensual / nom_consolidados) ─────────────

export interface ConsolidadoSaldos { por_pagar: number; anticipos_sin_aplicar: number; prestamos: number }

export interface ConsolidadoTrabajador {
  trabajador_id: string
  codigo: string
  nombre: string
  puesto: string | null
  activo: boolean
  inicial: ConsolidadoSaldos
  reconocido: {
    cortes: number; cortes_anulados: number; percepciones: number; reembolsos: number; deducciones: number
    de_ellas_recuperacion_prestamo: number; neto: number
  }
  entregado: { pagos: number; anticipos: number; reversiones: number; total: number }
  aplicado_a_cortes: number
  traspaso_a_prestamo: number
  prestamos: { otorgados: number; recuperados_y_ajustes: number }
  final: ConsolidadoSaldos
  sin_movimiento: boolean
}

export interface ConsolidadoMovimiento {
  pago_id: string
  codigo: string
  nombre: string
  tipo: string
  tipo_original: string | null
  monto: number
  metodo: string | null
  referencia: string | null
  fecha_pago: string
  registrado_en: string
  folio_corte: string | null
  semana_inicio: string | null
  semana_fin: string | null
  motivo: string | null
}

export interface ConsolidadoCorte {
  folio: string
  codigo: string
  nombre: string
  semana_inicio: string
  semana_fin: string
  evento: 'aprobado' | 'anulado'
  fecha: string
  percepciones: number
  reembolsos: number
  deducciones: number
  neto: number
  exceso_anticipo: number
  motivo?: string | null
}

export interface ConsolidadoIncidencia {
  codigo: string
  bloquea: boolean
  mensaje: string
  detalle?: unknown
}

export interface ConsolidadoResumen {
  trabajadores: number
  percepciones: number
  reembolsos: number
  deducciones: number
  neto_reconocido: number
  entregado_pagos: number
  entregado_anticipos: number
  reversiones: number
  entregado_total: number
  aplicado_a_cortes: number
  traspaso_a_prestamo: number
  por_pagar_inicial: number
  por_pagar_final: number
  anticipos_sin_aplicar_final: number
  prestamos_final: number
}

export interface ConsolidadoDatos {
  organizacion: string
  mes: string
  desde: string
  hasta: string
  moneda: string
  zona_horaria: string
  base: string
  as_of: string
  fuentes_hash: string
  preliminar: boolean
  en_curso: boolean
  resumen: ConsolidadoResumen
  trabajadores: ConsolidadoTrabajador[]
  movimientos: ConsolidadoMovimiento[]
  cortes: ConsolidadoCorte[]
  incidencias: ConsolidadoIncidencia[]
}

export type EstadoConsolidado = 'borrador' | 'finalizado' | 'sustituido'
export type EntregaConsolidado = 'no_entregado' | 'entrega_registrada' | 'acuse_registrado'

export interface ConsolidadoLista {
  id: string
  mes: string
  revision: number
  estado: EstadoConsolidado
  preliminar: boolean
  generado_en: string
  generado_por: string | null
  finalizado_en: string | null
  entrega_estado: EntregaConsolidado
  entregado_a: string | null
  entregado_en: string | null
  acuse_en: string | null
  resumen: ConsolidadoResumen
  fuentes_actualizadas: boolean
}

/** Revisión guardada: la lista más sus datos congelados. */
export interface ConsolidadoGuardado extends ConsolidadoLista { datos: ConsolidadoDatos }
