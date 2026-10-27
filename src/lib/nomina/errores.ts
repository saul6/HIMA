import { toast } from 'sonner'

/** Códigos de reglas de negocio de M81 (el servidor responde `CODIGO: mensaje`). */
const CODIGOS_NEGOCIO = new Set([
  'FORBIDDEN', 'NOT_FOUND', 'NOMINA_NO_HABILITADA', 'FECHA_ANTERIOR_ARRANQUE', 'FECHA_FUTURA', 'FUERA_DE_ALTA',
  'TRABAJADOR_HISTORICO', 'SETTLEMENT_IMMUTABLE', 'PERIOD_LOCKED', 'VERSION_CONFLICT', 'INPUTS_CHANGED',
  'CORTE_YA_APROBADO', 'CORTE_CON_BLOQUEOS', 'CORTE_CON_PAGOS', 'CORTE_CON_PRESTAMO_EN_USO', 'AJUSTE_APLICADO',
  'AJUSTE_NO_PENDIENTE', 'PAYMENT_EXCEEDS_PENDING', 'REVERSAL_EXCEEDS_ORIGINAL', 'REVERSION_INVALIDA',
  'ANTICIPO_CON_PRESTAMO', 'IDEMPOTENCY_CONFLICT', 'IDEMPOTENCY_REQUIRED', 'MONTO_INVALIDO', 'MOTIVO_REQUERIDO',
  'VIGENCIA_TRASLAPADA', 'CODIGO_DUPLICADO', 'NOMBRE_DUPLICADO', 'RECLASIFICAR_USADA', 'CONCEPTO_SISTEMA',
  'CONCEPTO_ARCHIVADO', 'ACTIVIDAD_ARCHIVADA', 'IMPORTE_EN_INFORMATIVA', 'INSUFFICIENT_ACCOUNT_BALANCE',
  'MES_ANTERIOR_ARRANQUE', 'MES_FUTURO', 'MES_EN_CURSO', 'CONSOLIDADO_CON_PENDIENTES', 'FUENTES_CAMBIARON',
  'CONSOLIDADO_NO_BORRADOR',
])

export interface ErrorNomina extends Error {
  codigo: string | null
}

/** Separa `CODIGO: mensaje`. El texto después de `: ` ya viene en español. */
export function parsearErrorNomina(err: unknown): { codigo: string | null; mensaje: string } {
  const bruto =
    typeof err === 'string' ? err : (err as { message?: string } | null)?.message ?? ''
  const m = /(?:^|\b)([A-Z][A-Z_]{2,}):\s*([\s\S]*)$/.exec(bruto)
  if (m && CODIGOS_NEGOCIO.has(m[1])) return { codigo: m[1], mensaje: m[2].trim() || bruto }
  return { codigo: null, mensaje: bruto || 'No se pudo completar la operación' }
}

export function crearErrorNomina(err: unknown): ErrorNomina {
  const { codigo, mensaje } = parsearErrorNomina(err)
  const e = new Error(mensaje) as ErrorNomina
  e.codigo = codigo
  return e
}

export function codigoErrorNomina(err: unknown): string | null {
  return (err as ErrorNomina | null)?.codigo ?? parsearErrorNomina(err).codigo
}

/** Reglas de negocio → warning; fallos → error. Devuelve el código (si lo hay). */
export function avisarErrorNomina(err: unknown, porDefecto = 'No se pudo completar la operación'): string | null {
  const { codigo, mensaje } = parsearErrorNomina(err)
  if (codigo) toast.warning(mensaje, { duration: 7000 })
  else toast.error(mensaje === 'No se pudo completar la operación' ? porDefecto : mensaje)
  return codigo
}
