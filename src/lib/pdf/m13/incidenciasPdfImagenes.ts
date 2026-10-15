// Helper: descarga + re-compresion de fotos del bucket privado para embeberlas en el PDF.
// Las fotos se almacenan a ~1600px (Fase 2). Aqui las reducimos a ~800px para el PDF.
// Devuelve data URI base64 lista para <Image src={...} /> de @react-pdf/renderer.
// Si la compresion falla, embebe la imagen original descargada como fallback (no celda vacia).

import imageCompression from 'browser-image-compression'
import { supabase } from '@/lib/supabase'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res) => {
    const r = new FileReader()
    r.onloadend = () => res(typeof r.result === 'string' ? r.result : '')
    r.onerror = () => res('')
    r.readAsDataURL(blob)
  })
}

export async function fotoADataUri(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('incidencias').download(storagePath)
  if (error || !data) {
    console.error('[M13 pdf foto] download', storagePath, error)
    return ''
  }

  try {
    const file = new File([data], 'foto.jpg', { type: data.type || 'image/jpeg' })
    const comprimida = await imageCompression(file, {
      maxWidthOrHeight: 800,
      maxSizeMB: 0.15,
      fileType: 'image/jpeg',
      initialQuality: 0.6,
      useWebWorker: false,
    })
    return await imageCompression.getDataUrlFromFile(comprimida)
  } catch (err) {
    console.error('[M13 pdf foto] compress', storagePath, err)
    return await blobToDataUrl(data)
  }
}

// Descarga las fotos con concurrencia acotada (muchas fotos en paralelo saturan memoria y congelan la página).
// Los fallos se resuelven como '' (placeholder).
const CONCURRENCIA_FOTOS_PDF = 4

export async function fotosADataUris(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const salida: Record<string, string> = {}
  let siguiente = 0
  async function worker() {
    while (siguiente < paths.length) {
      const path = paths[siguiente++]
      salida[path] = await fotoADataUri(path)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCIA_FOTOS_PDF, paths.length) }, worker))
  return salida
}

export { dimensionesDeDataUri } from './dimensionesImagen'
