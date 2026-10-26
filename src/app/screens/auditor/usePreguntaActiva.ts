import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

// Contenedor que hace scroll alrededor de `el` (el del Layout, no la ventana); null = la ventana.
function contenedorConScroll(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if (o === 'auto' || o === 'scroll') return p
  }
  return null
}

/**
 * Pregunta activa = la tarjeta `preg-<id>` visible más arriba en pantalla. Solo visual: observa, no guarda.
 * `refLeerVar` es un elemento que hereda `--alto-header` (alto del header sticky, para el `rootMargin`).
 * Las tarjetas de bloques plegados (`hidden`) no intersectan, así que no cuentan. Solo se actualiza el
 * estado cuando la activa cambia.
 */
export function usePreguntaActiva(ids: string[], refLeerVar: RefObject<HTMLElement | null>): string | null {
  const [activa, setActiva] = useState<string | null>(null)
  const clave = ids.join('|')

  useEffect(() => {
    if (ids.length === 0 || typeof IntersectionObserver === 'undefined') return
    const elementos = ids
      .map(id => [id, document.getElementById(`preg-${id}`)] as const)
      .filter((par): par is readonly [string, HTMLElement] => par[1] !== null)
    if (elementos.length === 0) return

    const altoHeader = parseFloat(
      refLeerVar.current ? getComputedStyle(refLeerVar.current).getPropertyValue('--alto-header') : '',
    ) || 0
    const porElemento = new Map<Element, string>(elementos.map(([id, el]) => [el, id]))
    const visibles = new Set<Element>()

    const observer = new IntersectionObserver(entradas => {
      for (const e of entradas) {
        if (e.isIntersecting) visibles.add(e.target)
        else visibles.delete(e.target)
      }
      let mejor: Element | null = null
      let top = Infinity
      for (const el of visibles) {
        const t = el.getBoundingClientRect().top
        if (t < top) { top = t; mejor = el }
      }
      const id = mejor ? porElemento.get(mejor) ?? null : null
      setActiva(prev => (id === null || prev === id ? prev : id))
    }, {
      root: contenedorConScroll(elementos[0][1]),
      rootMargin: `-${altoHeader}px 0px 0px 0px`,
    })
    for (const [, el] of elementos) observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  return activa
}
