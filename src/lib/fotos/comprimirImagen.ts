import imageCompression from 'browser-image-compression'

function toJpeg(blob: File | Blob, originalName: string): File {
  const name = originalName.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], name, { type: 'image/jpeg' })
}

// Comprime una imagen hasta quedar bajo `limiteMB`. Intento primario: 1.5 MB /
// 1920 px; si aún supera el límite, segundo intento más agresivo. Siempre
// devuelve un File jpeg. En caso de error devuelve el original sin modificar.
export async function comprimirImagen(file: File, limiteMB = 5.5): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  const limiteBytes = limiteMB * 1024 * 1024
  try {
    const out1 = await imageCompression(file, {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      initialQuality: 0.8,
      fileType: 'image/jpeg',
    })
    const jpg1 = toJpeg(out1, file.name)
    if (jpg1.size <= limiteBytes) return jpg1
    const out2 = await imageCompression(jpg1, {
      maxSizeMB: Math.min(0.8, limiteMB * 0.8),
      maxWidthOrHeight: 1280,
      useWebWorker: true,
      initialQuality: 0.7,
      fileType: 'image/jpeg',
    })
    return toJpeg(out2, file.name)
  } catch {
    return file
  }
}
