import { AlertTriangle } from 'lucide-react'

interface Props {
  limiteInfo: { proxima: string } | null
  hayConflictoOffline: boolean
  terminoSingular: string
  terminoGenero: 'f' | 'm'
  descripcionLimite?: string
}

// Banner ámbar en el formulario cuando hay un registro en la ventana del límite
// o un lote offline que conflictúa.
export function BannerLimiteOffline({
  limiteInfo,
  hayConflictoOffline,
  terminoSingular,
  terminoGenero,
  descripcionLimite,
}: Props) {
  if (!limiteInfo && !hayConflictoOffline) return null

  const articulo = terminoGenero === 'f' ? 'esta' : 'este'

  const mensaje = hayConflictoOffline && !limiteInfo
    ? `Ya tienes un registro pendiente de subir para ${articulo} ${terminoSingular.toLowerCase()}.`
    : descripcionLimite
      ? descripcionLimite + (limiteInfo ? ` Próxima disponible: ${limiteInfo.proxima}.` : '')
      : `Ya existe un registro para ${articulo} ${terminoSingular.toLowerCase()}.${limiteInfo ? ` Próxima disponible: ${limiteInfo.proxima}.` : ''}`

  return (
    <div
      className="flex items-start gap-2 px-3 py-3 rounded-lg"
      style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <p className="text-xs" style={{ fontWeight: 600 }}>{mensaje}</p>
    </div>
  )
}
