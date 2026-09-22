// Motivo decorativo de hojas — trazo lineal, opacidad mínima y variada,
// puramente ornamental detrás del formulario en el panel oscuro de auth.
// No estorba la lectura. Color por token (--auth-leaf-stroke, derivado de
// --auth-accent, el sky de marca). Varias ramas en distintas esquinas/tamaños/
// opacidades para que se sienta orgánico y no repetitivo.

interface AuthLeavesDecorProps {
  className?: string
}

function LeafSprig() {
  return (
    <g fill="none" stroke="var(--auth-leaf-stroke)" strokeWidth="1.2" strokeLinecap="round">
      <path d="M0 120 C 10 80, 30 40, 60 0" />
      <path d="M8 96 C 22 90, 34 78, 38 62 C 24 66, 12 76, 8 96 Z" />
      <path d="M20 66 C 34 62, 46 52, 52 36 C 36 38, 24 48, 20 66 Z" />
      <path d="M32 36 C 44 30, 52 20, 56 6 C 42 10, 34 20, 32 36 Z" />
    </g>
  )
}

const SPRIGS = [
  { pos: 'absolute -top-4 -right-6', size: 180, rotate: 35, opacity: 0.06 },
  { pos: 'absolute -bottom-8 -left-10', size: 220, rotate: -150, opacity: 0.07 },
  { pos: 'absolute -top-10 -left-8', size: 130, rotate: -20, opacity: 0.04 },
  { pos: 'absolute -bottom-6 -right-4', size: 150, rotate: 165, opacity: 0.045 },
  { pos: 'absolute top-[38%] -right-10', size: 100, rotate: 60, opacity: 0.03 },
]

export function AuthLeavesDecor({ className = '' }: AuthLeavesDecorProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {SPRIGS.map((sprig, i) => (
        <svg
          key={i}
          className={sprig.pos}
          width={sprig.size}
          height={sprig.size}
          viewBox="0 0 60 120"
          style={{ transform: `rotate(${sprig.rotate}deg)`, opacity: sprig.opacity }}
        >
          <LeafSprig />
        </svg>
      ))}
    </div>
  )
}
