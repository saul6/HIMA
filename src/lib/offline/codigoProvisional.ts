// Código local de un lote capturado sin conexión. El código real (LR, LC, LPT, FE) lo genera el
// servidor al sincronizar y siempre sobrescribe lo que se mande: nunca se envía en la fila.
export function codigoProvisional(id: string): string {
  return `PROV-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

export const TEXTO_ETIQUETA_PENDIENTE = 'La etiqueta estará disponible cuando se suba el lote'
