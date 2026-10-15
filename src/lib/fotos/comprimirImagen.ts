import imageCompression from 'browser-image-compression'

function toJpeg(blob: File | Blob, originalName: string): File {
  const name = originalName.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], name, { type: 'image/jpeg' })
}

// Reduce primero a máx. 1920 px con createImageBitmap (decodifica ya reducido,
// usa mucha menos memoria que decodificar la foto completa). Si el navegador no
// lo soporta o falla, devuelve el archivo original.
async function prerreducir(file: File): Promise<File | Blob> {
  if (typeof createImageBitmap !== 'function' || file.size <= 1.5 * 1024 * 1024) return file
  let bmp: ImageBitmap | null = null
  try {
    bmp = await createImageBitmap(file, { resizeWidth: 1920, resizeQuality: 'medium' })
    const canvas = document.createElement('canvas')
    canvas.width = bmp.width
    canvas.height = bmp.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bmp, 0, 0)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
    canvas.width = 0
    canvas.height = 0
    return blob && blob.size > 0 ? new File([blob], file.name, { type: 'image/jpeg' }) : file
  } catch {
    return file
  } finally {
    bmp?.close()
  }
}

// Comprime una imagen hasta quedar bajo `limiteMB`. Intento primario: 1.5 MB /
// 1920 px; si aún supera el límite, segundo intento más agresivo. Siempre
// devuelve un File jpeg. En caso de error devuelve el original sin modificar.
export async function comprimirImagen(file: File, limiteMB = 5.5): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  const limiteBytes = limiteMB * 1024 * 1024
  try {
    const fuente = await prerreducir(file)
    const out1 = await imageCompression(fuente as File, {
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

// Comprime varias fotos de una en una (nunca en paralelo) para no reventar la
// memoria del teléfono. `onProgreso(actual, total)` se llama antes de cada foto.
export async function comprimirImagenesSecuencial(
  files: File[],
  limiteMB = 5.5,
  onProgreso?: (actual: number, total: number) => void,
): Promise<File[]> {
  const out: File[] = []
  for (let i = 0; i < files.length; i++) {
    onProgreso?.(i + 1, files.length)
    out.push(await comprimirImagen(files[i], limiteMB))
  }
  return out
}
