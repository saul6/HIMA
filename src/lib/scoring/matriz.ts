// PGFS-ND-020-R1 §10.2 Tabla 3 — discreta, común a los 7 módulos.
export const SCORE_MATRIX = {
  15: { TOTAL: 15, MINOR: 10, MAJOR: 5,  NON_COMPLIANCE: 0 },
  10: { TOTAL: 10, MINOR:  7, MAJOR: 3,  NON_COMPLIANCE: 0 },
  5:  { TOTAL:  5, MINOR:  3, MAJOR: 1,  NON_COMPLIANCE: 0 },
  3:  { TOTAL:  3, MINOR:  2, MAJOR: 1,  NON_COMPLIANCE: 0 },
} as const

export const RESP_TO_CLASS = {
  cumplimiento_total: 'TOTAL',
  deficiencia_menor:  'MINOR',
  deficiencia_mayor:  'MAJOR',
  no_conformidad:     'NON_COMPLIANCE',
} as const

export type ScoreMatrixKey = keyof typeof SCORE_MATRIX
export type ScoreClass     = (typeof RESP_TO_CLASS)[keyof typeof RESP_TO_CLASS]
