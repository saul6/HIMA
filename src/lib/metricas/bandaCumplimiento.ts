export type BandaCumplimiento = 'aprobatoria' | 'parcial' | 'reprobatoria' | 'sin_puntaje'

export function bandaCumplimiento(porcentaje: number, posibles: number): BandaCumplimiento {
  if (posibles === 0) return 'sin_puntaje'
  if (porcentaje >= 80) return 'aprobatoria'
  if (porcentaje >= 70) return 'parcial'
  return 'reprobatoria'
}
