// Spring compartido para microinteracciones vivas pero elegantes (pin, pastillas
// de indicador). Un solo valor en toda la app para que todas las "pastillas"
// y pops se sientan de la misma familia de movimiento.
export const SPRING_SUAVE = { type: 'spring', visualDuration: 0.35, bounce: 0.15 } as const

// Variante sin rebote — para barras/líneas de progreso, donde un overshoot
// de escala se nota como un parpadeo en vez de un rebote natural.
export const SPRING_SUAVE_SIN_REBOTE = { ...SPRING_SUAVE, bounce: 0 } as const

// Tiempos y curva de movimiento en JS: espejo de --motion-fast / --motion-base /
// --motion-slow y --ease-out de theme.css. Si cambias uno, cambia el otro.
export const DUR = { rapido: 0.15, base: 0.22, lento: 0.3 } as const

export const EASE_OUT = [0.22, 1, 0.36, 1] as const
