export const FENOLOGIA_LABELS: Record<string, string> = {
  establecimiento: 'Establecimiento',
  floracion:       'Floración',
  cuajado:         'Cuajado de fruto',
  engorde:         'Engorde',
  produccion:      'Producción',
  cosecha:         'Cosecha',
}

export function formatFenologia(f: string | null | undefined): string {
  if (!f) return '—'
  return FENOLOGIA_LABELS[f] ?? (f.charAt(0).toUpperCase() + f.slice(1))
}
