import { toast } from 'sonner'

/** Etiqueta visible de las columnas más comunes (si no está, se usa el nombre con espacios). */
const ETIQUETAS_COLUMNA: Record<string, string> = {
  observaciones: 'Observaciones',
  observacion: 'Observación',
  comentario: 'Comentario',
  comentario_correccion: 'Comentario de corrección',
  descripcion: 'Descripción',
  descripcion_incidente: 'Descripción del incidente',
  descripcion_solicitud: 'Descripción de la solicitud',
  descripcion_trabajo: 'Descripción del trabajo',
  descripcion_muestra: 'Descripción de la muestra',
  direccion: 'Dirección',
  domicilio: 'Domicilio',
  nombre: 'Nombre',
  realizo: 'Realizó',
  verifico: 'Verificó',
  aprobo: 'Aprobó',
  sector: 'Sector',
  cultivo: 'Cultivo',
  empresa: 'Empresa',
  folio: 'Folio',
  producto: 'Producto',
  restos: 'Restos',
  resultado: 'Resultado',
  uso: 'Uso',
  correccion: 'Corrección',
  acciones_tomadas: 'Acciones tomadas',
  auditor_nombre: 'Nombre del auditor',
  num_trampa: 'Número de trampa',
  motivo: 'Motivo',
  leyenda: 'Leyenda',
  notas: 'Notas',
}

function etiquetaColumna(columna: string): string {
  return ETIQUETAS_COLUMNA[columna] ?? columna.replace(/_/g, ' ')
}

/** Traduce errores de los triggers de límites de la BD a mensajes para el usuario. */
export function traducirErrorBd(msg: string): string | null {
  const largo = msg.match(/TEXTO_MUY_LARGO[^"]*"([^"]+)"[^0-9]*(\d+)/)
  if (largo) return `El campo ${etiquetaColumna(largo[1])} admite hasta ${largo[2]} caracteres`
  if (msg.includes('TEXTO_MUY_LARGO')) return 'Un campo de texto excede el máximo de caracteres permitido'
  const fotos = msg.match(/FOTOS_MAXIMO:?\s*([^\n"]*)/)
  if (fotos) return fotos[1].trim() || 'Se superó el máximo de fotos permitido'
  return null
}

/**
 * Mensaje listo para mostrar a partir de cualquier error de guardado (Error, PostgrestError, string).
 * Úsalo en los `catch` que muestran el error en línea (banners, texto) en vez de `toast`.
 */
export function mensajeErrorBd(err: unknown, porDefecto = 'No se pudo guardar'): string {
  const msg =
    typeof err === 'string'
      ? err
      : (err as { message?: string } | null)?.message ?? ''
  if (!msg) return porDefecto
  return traducirErrorBd(msg) ?? msg
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
