import { useSearchParams } from 'react-router'

export function useContextoTarea(ranchos: { id: string }[]) {
  const [searchParams, setSearchParams] = useSearchParams()

  const ranchoParam = searchParams.get('rancho')
  const tareaId = searchParams.get('tarea')

  // Solo confiar en el rancho de la URL si existe en los ranchos de la org cargados.
  // Mientras ranchos es [] (loading), ranchoInicial queda null.
  const ranchoInicial =
    ranchoParam && ranchos.some((r) => r.id === ranchoParam) ? ranchoParam : null

  function limpiar() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('rancho')
        next.delete('tarea')
        return next
      },
      { replace: true },
    )
  }

  return { ranchoInicial, tareaId, limpiar }
}
