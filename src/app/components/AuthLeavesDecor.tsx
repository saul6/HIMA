// Motivo decorativo de hojas — trazo lineal, opacidad mínima, puramente
// ornamental detrás del formulario en el panel oscuro de auth. No estorba la
// lectura. Color por token (--auth-leaf-stroke, derivado de --secondary).

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

export function AuthLeavesDecor({ className = '' }: AuthLeavesDecorProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ opacity: 0.06 }}
    >
      <svg
        className="absolute -top-4 -right-6"
        width="180"
        height="180"
        viewBox="0 0 60 120"
        style={{ transform: 'rotate(35deg)' }}
      >
        <LeafSprig />
      </svg>
      <svg
        className="absolute -bottom-8 -left-10"
        width="220"
        height="220"
        viewBox="0 0 60 120"
        style={{ transform: 'rotate(-150deg)' }}
      >
        <LeafSprig />
      </svg>
    </div>
  )
}
