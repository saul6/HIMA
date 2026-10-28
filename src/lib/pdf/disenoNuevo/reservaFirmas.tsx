// Las firmas nunca quedan solas en una hoja.
// react-pdf solo revisa "¿cabe lo que sigue?" entre hermanos de un mismo contenedor y solo baja a los renglones de
// una tabla cuando esa tabla se parte. Por eso, para que el último renglón viaje con las firmas, estas se dibujan
// como último hermano de ese renglón: PaginaEstandar detecta que su último hijo lleva <PdfFirmas> y, si el hijo
// anterior termina en una <TablaDatos> (típico: <Seccion><TablaDatos/></Seccion>), se las entrega a la tabla
// (`firmasDespues`). Si no termina en tabla, el hijo anterior se envuelve con `minPresenceAhead` para que viaje
// junto con las firmas cuando es un bloque corto (franja de observaciones, cajas de totales...).
// El orden y el contenido del PDF no cambian: las firmas siguen yendo después de ese bloque.
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { View } from '@react-pdf/renderer'
import { PdfFirmas } from './PdfFirmas'
import { TablaDatos } from './TablaDatos'
import { FranjaDatos } from './Franja'
import { Leyenda } from './Leyenda'
import { Seccion } from './PaginaEstandar'

/** Alto aproximado del bloque de firmas con su título de sección (margen + firma + línea + rótulos). */
export const ALTO_FIRMAS = 170

type ConHijos = { children?: ReactNode }

/** true si algún descendiente (siguiendo `children`) es un <PdfFirmas>. */
export function llevaFirmas(nodo: ReactNode): boolean {
  let hay = false
  Children.forEach(nodo, (h) => {
    if (hay || !isValidElement(h)) return
    const el = h as ReactElement<ConHijos>
    if (el.type === PdfFirmas || llevaFirmas(el.props.children)) hay = true
  })
  return hay
}

/** Devuelve `el` con `firmas` dentro de su última <TablaDatos> (siguiendo el último hijo), o null si no termina en tabla. */
function inyectar(el: ReactElement<ConHijos>, firmas: ReactNode): ReactElement | null {
  if (el.type === TablaDatos) return cloneElement(el as ReactElement<{ firmasDespues?: ReactNode }>, { firmasDespues: firmas })
  const hijos = Children.toArray(el.props.children)
  const ult = hijos[hijos.length - 1]
  if (!isValidElement(ult)) return null
  const dentro = inyectar(ult as ReactElement<ConHijos>, firmas)
  return dentro ? cloneElement(el, {}, ...hijos.slice(0, -1), dentro) : null
}

/** Suma de los textos literales (children string/number) de un árbol de elementos. */
function textoTotal(nodo: ReactNode): number {
  let n = 0
  Children.forEach(nodo, (h) => {
    if (typeof h === 'string' || typeof h === 'number') n += String(h).length
    else if (isValidElement(h)) n += textoTotal((h as ReactElement<ConHijos>).props.children)
  })
  return n
}

function contiene(nodo: ReactNode, tipo: unknown): boolean {
  let hay = false
  Children.forEach(nodo, (h) => {
    if (hay || !isValidElement(h)) return
    hay = h.type === tipo || contiene((h as ReactElement<ConHijos>).props.children, tipo)
  })
  return hay
}

/** Franja con poco texto, leyenda o caja (View) de totales: bloques que caben de sobra en una hoja. */
function esBloqueCorto(el: ReactElement): boolean {
  if (el.type === Leyenda || el.type === View) return true
  if (el.type === Seccion) return !contiene(el, TablaDatos) && textoTotal(el) <= 400
  if (el.type === FranjaDatos) {
    const campos = ((el.props as { campos?: { valor?: string | null }[] }).campos ?? [])
    return campos.reduce((n, c) => n + (c.valor?.length ?? 0), 0) <= 400
  }
  return false
}

/** Aplica la regla "firmas nunca solas" a los hijos de una página (ver cabecera). */
export function integrarFirmas(hijos: ReactNode): ReactNode {
  const lista = Children.toArray(hijos)
  const n = lista.length
  if (n < 2) return hijos
  const ult = lista[n - 1]
  const prev = lista[n - 2]
  if (!isValidElement(ult) || !isValidElement(prev) || !(ult.type === PdfFirmas || llevaFirmas(ult))) return hijos
  const conTabla = inyectar(prev as ReactElement<ConHijos>, ult)
  if (conTabla) return [...lista.slice(0, n - 2), conTabla]
  // Sin tabla al final: solo los bloques cortos conocidos viajan con las firmas (un bloque alto movido completo dejaría la hoja vacía;
  // un texto largo que se parte no se envuelve: lo parte su propio componente).
  if (esBloqueCorto(prev)) {
    return [...lista.slice(0, n - 2), <View key="antes-de-firmas" minPresenceAhead={ALTO_FIRMAS}>{prev}</View>, ult]
  }
  return hijos
}
