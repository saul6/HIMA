// Estado compartido para determinar si es seguro aplicar una actualización PWA
// sin interrumpir al usuario ni perder datos en curso.

// ── BottomSheets abiertas ─────────────────────────────────────────────────────
let _ventanasAbiertas = 0

export function sumarVentana(): void { _ventanasAbiertas++ }

export function restarVentana(): void {
  if (_ventanasAbiertas > 0) _ventanasAbiertas--
  window.dispatchEvent(new CustomEvent(SEGURIDAD_CAMBIO_EVENT))
}

export function ventanasAbiertas(): number { return _ventanasAbiertas }

// ── Capturas de pantalla completa (p.ej. M1 stepper) ─────────────────────────
let _capturaEnCurso = false

export function marcarCapturaEnCurso(v: boolean): void {
  _capturaEnCurso = v
  if (!v) window.dispatchEvent(new CustomEvent(SEGURIDAD_CAMBIO_EVENT))
}

// ── Estado de sincronización (set desde sync.ts) ──────────────────────────────
let _sincronizando = false

export function setSincronizando(v: boolean): void {
  const antes = _sincronizando
  _sincronizando = v
  // Solo notifica cuando termina (false) — al iniciar no hay nada que revisar
  if (antes && !v) window.dispatchEvent(new CustomEvent(SEGURIDAD_CAMBIO_EVENT))
}

// ── Evento que señala que el estado de seguridad puede haber cambiado ─────────
export const SEGURIDAD_CAMBIO_EVENT = 'mady:seguridad-cambio'

export function esSeguroActualizar(): boolean {
  return _ventanasAbiertas === 0 && !_capturaEnCurso && !_sincronizando
}

// ── Update disponible (para que Perfil muestre el indicador) ──────────────────
let _updateDisponible = false
let _fnActualizar: (() => void) | null = null

export const UPDATE_DISPONIBLE_EVENT = 'mady:update-disponible'

export function señalarUpdateDisponible(disponible: boolean, fn?: () => void): void {
  _updateDisponible = disponible
  if (fn) _fnActualizar = fn
  window.dispatchEvent(new CustomEvent(UPDATE_DISPONIBLE_EVENT))
}

export function isUpdateDisponible(): boolean { return _updateDisponible }

export function ejecutarActualizacion(): void { _fnActualizar?.() }
