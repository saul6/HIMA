import type { CSSProperties } from 'react'

interface Punto { x: number; y: number }

interface FirmaSvgProps {
  trazos: Punto[][]
  className?: string
  style?: CSSProperties
}

export function FirmaSvg({ trazos, className, style }: FirmaSvgProps) {
  const allPts = trazos.flat()
  if (allPts.length === 0) return null

  const xs = allPts.map(p => p.x)
  const ys = allPts.map(p => p.y)
  const margin = 8
  const minX = Math.min(...xs) - margin
  const minY = Math.min(...ys) - margin
  const vw = Math.max(...xs) + margin - minX
  const vh = Math.max(...ys) + margin - minY

  return (
    <svg
      className={className}
      style={style}
      viewBox={`${minX} ${minY} ${vw} ${vh}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      {trazos.map((trazo, i) => {
        if (trazo.length < 2) return null
        return (
          <polyline
            key={i}
            points={trazo.map(p => `${p.x},${p.y}`).join(' ')}
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )
      })}
    </svg>
  )
}
