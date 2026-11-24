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
 * Pregunta activa = la primera tarjeta `preg-<id>` visible que pasa de una línea de referencia (ver `calcular`).
 * Solo visual: observa, no guarda.
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

    // Se lee en cada cálculo: el padre publica `--alto-header` después de montar este efecto (vale 0 al inicio).
    const leerAltoHeader = () => parseFloat(
      refLeerVar.current ? getComputedStyle(refLeerVar.current).getPropertyValue('--alto-header') : '',
    ) || 0
    const altoHeader = leerAltoHeader()
    const porElemento = new Map<Element, string>(elementos.map(([id, el]) => [el, id]))
    const visibles = new Set<Element>()

    const root = contenedorConScroll(elementos[0][1])
    // Pregunta elegida con clic en el navegador: manda hasta que la persona vuelve a desplazarse sola.
    let forzada: string | null = null

    // Activa = primera tarjeta visible cuyo borde inferior pasa de una línea de referencia (~1/3 del área
    // visible bajo el header). Al acercarse al final del scroll la línea baja hasta el borde inferior, para
    // que las últimas preguntas también puedan quedar activas.
    function calcular() {
      if (forzada) { setActiva(prev => (prev === forzada ? prev : forzada)); return }
      const rect = root ? root.getBoundingClientRect() : { top: 0, height: window.innerHeight }
      const alto = leerAltoHeader()
      const areaTop = rect.top + alto
      const areaAlto = rect.height - alto
      const restante = root
        ? root.scrollHeight - root.scrollTop - root.clientHeight
        : document.documentElement.scrollHeight - window.scrollY - window.innerHeight
      const avance = 1 - Math.min(1, Math.max(0, restante) / (areaAlto / 2))
      const linea = areaTop + areaAlto * (1 / 3 + (2 / 3) * avance)

      let mejor: Element | null = null
      let topMejor = Infinity
      let ultimo: Element | null = null
      let topUltimo = -Infinity
      for (const el of visibles) {
        const r = el.getBoundingClientRect()
        if (r.bottom > linea && r.top < topMejor) { topMejor = r.top; mejor = el }
        if (r.top > topUltimo) { topUltimo = r.top; ultimo = el }
      }
      const elegido = mejor ?? ultimo
      const id = elegido ? porElemento.get(elegido) ?? null : null
      setActiva(prev => (id === null || prev === id ? prev : id))
    }

    const observer = new IntersectionObserver(entradas => {
      for (const e of entradas) {
        if (e.isIntersecting) visibles.add(e.target)
        else visibles.delete(e.target)
      }
      calcular()
    }, {
      root,
      rootMargin: `-${altoHeader}px 0px 0px 0px`,
    })
    for (const [, el] of elementos) observer.observe(el)

    let cuadro = 0
    const alDesplazar = () => {
      if (cuadro) return
      cuadro = requestAnimationFrame(() => { cuadro = 0; calcular() })
    }
    const escucha: HTMLElement | Window = root ?? window
    escucha.addEventListener('scroll', alDesplazar, { passive: true })

    const soltarForzada = () => { forzada = null }
    for (const ev of ['wheel', 'touchmove', 'keydown'] as const) escucha.addEventListener(ev, soltarForzada, { passive: true })

    const nav = refLeerVar.current
    const alClicNavegador = (e: Event) => {
      const fila = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-nav-id]')
      const id = fila?.dataset.navId
      if (id && porElemento.has(document.getElementById(`preg-${id}`) as Element)) {
        forzada = id
        setActiva(prev => (prev === id ? prev : id))
      }
    }
    nav?.addEventListener('click', alClicNavegador)

    return () => {
      observer.disconnect()
      if (cuadro) cancelAnimationFrame(cuadro)
      escucha.removeEventListener('scroll', alDesplazar)
      for (const ev of ['wheel', 'touchmove', 'keydown'] as const) escucha.removeEventListener(ev, soltarForzada)
      nav?.removeEventListener('click', alClicNavegador)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  return activa
}
