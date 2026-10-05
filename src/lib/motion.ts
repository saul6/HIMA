// Spring compartido para microinteracciones vivas pero elegantes (pin, pastillas
// de indicador). Un solo valor en toda la app para que todas las "pastillas"
// y pops se sientan de la misma familia de movimiento.
export const SPRING_SUAVE = { type: 'spring', visualDuration: 0.35, bounce: 0.15 } as const

// Variante sin rebote — para barras/líneas de progreso, donde un overshoot
// de escala se nota como un parpadeo en vez de un rebote natural.
export const SPRING_SUAVE_SIN_REBOTE = { ...SPRING_SUAVE, bounce: 0 } as const
