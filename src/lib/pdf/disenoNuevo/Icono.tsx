// Iconos vectoriales (viewBox 24, trazo navy) del diseño nuevo. Sin Unicode: son Svg.
import { Svg, Path, Rect, Circle } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import { PC } from '@/lib/pdf/components/tokens'

export type IconoNombre = 'usuario' | 'folio' | 'calendario' | 'codigo' | 'imagen' | 'alerta' | 'ubicacion'

export function Icono({ nombre, size = 11, color = PC.m13Navy }: { nombre: IconoNombre; size?: number; color?: string }) {
  const p = { stroke: color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  let cuerpo: ReactNode
  switch (nombre) {
    case 'usuario':
      cuerpo = (<><Circle cx={12} cy={8} r={4} {...p} /><Path d="M4 21 C4 16 8 14 12 14 C16 14 20 16 20 21" {...p} /></>)
      break
    case 'folio':
      cuerpo = (<><Rect x={5} y={3} width={14} height={18} rx={2} {...p} /><Path d="M9 8 H15 M9 12 H15 M9 16 H13" {...p} /></>)
      break
    case 'calendario':
      cuerpo = (<><Rect x={3} y={5} width={18} height={16} rx={2} {...p} /><Path d="M3 10 H21 M8 3 V7 M16 3 V7" {...p} /></>)
      break
    case 'codigo':
      cuerpo = (<Path d="M8 7 L3 12 L8 17 M16 7 L21 12 L16 17 M14 5 L10 19" {...p} />)
      break
    case 'imagen':
      cuerpo = (<><Rect x={3} y={4} width={18} height={16} rx={2} {...p} /><Circle cx={9} cy={10} r={1.8} {...p} /><Path d="M3 17 L9 12 L13 16 L16 13 L21 18" {...p} /></>)
      break
    case 'alerta':
      cuerpo = (<><Path d="M12 3 L22 20 H2 Z" {...p} /><Path d="M12 9 V14" {...p} /><Circle cx={12} cy={17} r={0.8} stroke={color} strokeWidth={1} fill={color} /></>)
      break
    case 'ubicacion':
      cuerpo = (<><Path d="M12 21 C12 21 5 14.5 5 9.5 A7 7 0 0 1 19 9.5 C19 14.5 12 21 12 21 Z" {...p} /><Circle cx={12} cy={9.5} r={2.5} {...p} /></>)
      break
  }
  return <Svg viewBox="0 0 24 24" width={size} height={size}>{cuerpo}</Svg>
}
