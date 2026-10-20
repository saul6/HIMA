import * as React from 'react'
import { Link } from 'react-router'
import { CheckSquare, ChevronRight, Square } from 'lucide-react'
import { cn } from '../ui/utils'

type TonoFila = 'normal' | 'resaltado' | 'resaltadoConTexto'

interface FilaRegistroProps {
  /** `fila`: renglón compacto con border-b. `tarjeta`: caja con borde y esquinas redondeadas. */
  variante?: 'fila' | 'tarjeta'
  /** Ícono (32px) o, si no hay, la inicial del título (solo `fila`). `null` no muestra nada; con `seleccionable` lo reemplaza el checkbox. */
  icono?: React.ReactNode
  /** Contenido sobre el título (chips/etiquetas). */
  etiquetas?: React.ReactNode
  titulo: React.ReactNode
  /** Una línea truncada bajo el título. */
  subtitulo?: React.ReactNode
  /** Bloque libre bajo el título, sin truncar (varias líneas o líneas con chips). */
  lineas?: React.ReactNode
  /** Etiqueta o contenido a la derecha. */
  derecha?: React.ReactNode
  /** Botones de acción: a la derecha en `fila`, debajo en `tarjeta` (fuera del área clicable). */
  acciones?: React.ReactNode
  chevron?: boolean
  /** `resaltado`: borde menta y fondo de aviso. `resaltadoConTexto` además tiñe el texto. */
  tono?: TonoFila
  /** Muestra un checkbox al inicio; la zona clicable es un button con aria-pressed. */
  seleccionable?: boolean
  seleccionado?: boolean
  /** Para filas desplegables: aria-expanded de la zona clicable. */
  expandido?: boolean
  /** `compacto` usa p-3 en vez de p-4 (solo `tarjeta`). */
  relleno?: 'normal' | 'compacto'
  /** Con `to` es Link; con `onClick` es button; sin ninguno, zona estática. */
  to?: string
  onClick?: () => void
  /** Contenido a ancho completo bajo el encabezado (mensajes, botones, comentarios). */
  children?: React.ReactNode
  /** Solo `tarjeta`: contenido desplegado, separado por una línea superior. */
  detalle?: React.ReactNode
  className?: string
}

/** Fila de lista ~56px (o tarjeta): ícono/inicial 32px, título 14/600, subtítulo 12 muted,
 * contenido a la derecha, chevron opcional.
 * Uso: <FilaRegistro titulo="Rancho 1" subtitulo="12 may" derecha={<Etiqueta .../>} onClick={...} /> */
export function FilaRegistro({
  variante = 'fila', icono, etiquetas, titulo, subtitulo, lineas, derecha, acciones, chevron,
  tono = 'normal', seleccionable, seleccionado = false, expandido, relleno = 'normal',
  to, onClick, children, detalle, className,
}: FilaRegistroProps) {
  const tarjeta = variante === 'tarjeta'
  const resaltado = tono !== 'normal'
  const textoAviso = tono === 'resaltadoConTexto'
  const inicial = !tarjeta && icono !== null && typeof titulo === 'string' ? titulo.trim().charAt(0).toUpperCase() : ''

  let marca: React.ReactNode = null
  if (seleccionable) {
    marca = (
      <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden="true">
        {seleccionado
          ? <CheckSquare size={16} className="text-primary" />
          : <Square size={16} className="text-muted-foreground" />}
      </span>
    )
  } else if (icono !== null && (icono || inicial)) {
    marca = (
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
        aria-hidden={icono ? undefined : true}
      >
        {icono ?? inicial}
      </span>
    )
  }

  const contenido = (
    <>
      {marca}
      <span className="min-w-0 flex-1 text-left">
        {etiquetas && <span className="mb-1 flex flex-wrap items-center gap-2">{etiquetas}</span>}
        <span className={cn('block text-sm font-semibold', !tarjeta && 'truncate', textoAviso ? 'text-agro-info-text' : 'text-foreground')}>
          {titulo}
        </span>
        {subtitulo && <span className="block truncate text-xs text-muted-foreground">{subtitulo}</span>}
        {lineas && (
          <span className={cn('mt-0.5 block text-xs', textoAviso ? 'text-agro-info-text' : 'text-muted-foreground')}>
            {lineas}
          </span>
        )}
      </span>
      {derecha}
      {chevron && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
    </>
  )

  const hayCuerpo = tarjeta && (!!acciones || !!children)
  const pad = relleno === 'compacto' ? 'p-3' : 'p-4'
  const claseZona = cn(
    'flex min-w-0 flex-1 items-center gap-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
    tarjeta ? ['w-full items-start', pad, hayCuerpo && 'pb-0'] : 'min-h-14 py-2',
    seleccionable && !tarjeta && 'px-4 py-3 active:opacity-70 transition-opacity',
  )

  let zona: React.ReactNode
  if (to) zona = <Link to={to} className={claseZona}>{contenido}</Link>
  else if (seleccionable) {
    zona = <button type="button" aria-pressed={seleccionado} onClick={onClick} className={claseZona}>{contenido}</button>
  } else if (onClick) {
    zona = <button type="button" aria-expanded={expandido} onClick={onClick} className={claseZona}>{contenido}</button>
  } else zona = <div className={claseZona}>{contenido}</div>

  const clase = cn(
    tarjeta
      ? 'rounded-xl border bg-card'
      : 'border-b border-border',
    tarjeta && (resaltado ? 'border-agro-menta bg-agro-info-fill' : 'border-border'),
    !tarjeta && resaltado && 'rounded-xl border border-agro-menta bg-agro-info-fill px-3',
    seleccionado && !resaltado && 'bg-agro-success-fill',
    className,
  )

  if (tarjeta) {
    return (
      <div className={clase}>
        <div className="flex items-start gap-2">{zona}</div>
        {hayCuerpo && (
          <div className={cn('space-y-2 pt-2', relleno === 'compacto' ? 'px-3 pb-3' : 'px-4 pb-4')}>
            {children}
            {acciones && <div className="flex flex-wrap gap-2 pt-1">{acciones}</div>}
          </div>
        )}
        {detalle && <div className="space-y-2 border-t border-border px-3 py-3">{detalle}</div>}
      </div>
    )
  }

  return (
    <div className={clase}>
      <div className="flex items-center gap-2">
        {zona}
        {acciones}
      </div>
      {children}
    </div>
  )
}
