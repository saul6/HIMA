const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export function validarImagen(file: File): string | null {
  if (!MIME_PERMITIDOS.includes(file.type)) {
    return 'Solo imágenes JPG, PNG o WEBP'
  }
  if (file.size > MAX_BYTES) {
    return 'La imagen no puede superar 10 MB'
  }
  return null
}
