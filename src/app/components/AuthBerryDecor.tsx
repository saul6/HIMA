// Ilustración ornamental: una rama de berry en línea fina (3 hojas con
// nervadura y un racimo de moras), cortada por la esquina inferior derecha de
// la tarjeta de auth. Fija, sin animación, detrás del contenido y sin captar
// clics. Color por token (--auth-ornament), opacidad baja.

export function AuthBerryDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
    >
      <svg
        className="absolute -bottom-3 -right-3 w-[132px] h-[132px] lg:-bottom-4 lg:-right-4 lg:w-[210px] lg:h-[210px]"
        viewBox="0 0 220 220"
        style={{ opacity: 0.08 }}
      >
        <g
          fill="none"
          stroke="var(--auth-ornament)"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* tallo */}
          <path d="M208 216 C 172 172, 122 142, 62 70" />
          {/* hojas + nervadura */}
          <path d="M150 168 C 150 140, 172 122, 196 118 C 198 142, 178 162, 150 168 Z" />
          <path d="M150 168 L 190 124" />
          <path d="M118 142 C 96 130, 90 106, 98 86 C 122 94, 130 120, 118 142 Z" />
          <path d="M118 142 L 101 92" />
          <path d="M88 108 C 66 112, 44 102, 34 82 C 58 76, 80 88, 88 108 Z" />
          <path d="M88 108 L 40 83" />
          {/* pedúnculo del racimo */}
          <path d="M152 160 C 144 178, 128 188, 114 194" />
          {/* moras */}
          <circle cx="112" cy="200" r="9" />
          <circle cx="128" cy="193" r="9" />
          <circle cx="99" cy="188" r="8" />
          <circle cx="119" cy="181" r="8" />
          <circle cx="137" cy="182" r="7" />
        </g>
      </svg>
    </div>
  )
}
