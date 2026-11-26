// Errores EQ_* de las funciones del equipo (encargado → operarios).
// El mensaje de la BD empieza con el código; se muestra el texto en español.

const TEXTOS_EQ: Record<string, string> = {
  EQ_NO_AUTENTICADO: 'Inicia sesión.',
  EQ_SIN_PERMISO: 'No tienes permiso para esto.',
  EQ_ORG_REQUERIDA: 'Elige la organización.',
  EQ_OPERARIO_REQUERIDO: 'Elige un operario.',
  EQ_ENCARGADO_REQUERIDO: 'Elige un encargado.',
  EQ_SOLO_A_TI: 'Solo puedes agregar operarios a tu equipo.',
  EQ_OPERARIO_INVALIDO: 'Ese operario no está disponible.',
  EQ_ENCARGADO_INVALIDO: 'Ese encargado no está disponible.',
  EQ_YA_TIENE_ENCARGADO: 'Ese operario ya tiene encargado; pide al administrador que lo reasigne.',
  EQ_SIN_ASIGNACION: 'Ese operario no tiene encargado.',
  EQ_NO_ES_TU_OPERARIO: 'Ese registro no es de tu equipo.',
  EQ_MARCA_AJENA: 'Solo quien marcó o el administrador puede quitar la marca.',
}

/** Devuelve el texto en español si el mensaje trae un código EQ_*; si no, null. */
export function traducirErrorEquipo(msg: string): string | null {
  const m = msg.match(/EQ_[A-Z_]+/)
  if (!m) return null
  return TEXTOS_EQ[m[0]] ?? null
}
