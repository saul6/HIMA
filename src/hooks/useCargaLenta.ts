import { useEffect, useState } from 'react'

/** `true` cuando `activo` lleva más de `ms` encendido sin interrupción. Si `activo`
 * pasa a `false` se reinicia; el temporizador se limpia al desmontar. Solo observa:
 * no cambia cuándo empieza ni termina la carga. */
export function useCargaLenta(activo: boolean, ms = 12000): boolean {
  const [lenta, setLenta] = useState(false)

  useEffect(() => {
    if (!activo) {
      setLenta(false)
      return
    }
    const id = setTimeout(() => setLenta(true), ms)
    return () => clearTimeout(id)
  }, [activo, ms])

  return lenta
}
