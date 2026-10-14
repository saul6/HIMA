import { toast } from 'sonner'

/** Traduce errores de los triggers de límites de la BD a mensajes para el usuario. */
export function traducirErrorBd(msg: string): string | null {
  const largo = msg.match(/TEXTO_MUY_LARGO[^"]*"([^"]+)"[^0-9]*(\d+)/)
  if (largo) {
    const etiqueta = largo[1].replace(/_/g, ' ')
    return `El campo ${etiqueta} admite hasta ${largo[2]} caracteres`
  }
  if (msg.includes('TEXTO_MUY_LARGO')) return 'Un campo de texto excede el máximo de caracteres permitido'
  if (msg.includes('FOTOS_MAXIMO')) return 'Máximo 6 fotos por incidencia'
  return null
}

let instalado = false

/** Envuelve toast.error / toast.warning para que nunca se muestre el texto crudo de la BD. */
export function instalarTraduccionErroresBd() {
  if (instalado) return
  instalado = true
  for (const tipo of ['error', 'warning'] as const) {
    const original = toast[tipo].bind(toast)
    ;(toast as any)[tipo] = (mensaje: unknown, ...resto: unknown[]) => {
      const traducido = typeof mensaje === 'string' ? traducirErrorBd(mensaje) : null
      return (original as any)(traducido ?? mensaje, ...resto)
    }
  }
}
