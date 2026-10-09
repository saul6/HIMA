import { useEffect, useState } from 'react'

/** Decide si mostrar un skeleton: solo en la primera carga (sin datos aún) y
 * solo si `cargando` dura más de `delay` ms. Si ya hay datos, nunca vuelve a
 * mostrar el skeleton aunque `cargando` se active de nuevo (refetch). */
export function useMostrarCarga(cargando: boolean, hayDatos: boolean, delay = 150): boolean {
  const [mostrar, setMostrar] = useState(false)

  useEffect(() => {
    if (!cargando || hayDatos) {
      setMostrar(false)
      return
    }
    const id = setTimeout(() => setMostrar(true), delay)
    return () => clearTimeout(id)
  }, [cargando, hayDatos, delay])

  return mostrar
}
