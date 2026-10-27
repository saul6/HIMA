import imageCompression from 'browser-image-compression'
import { registrarEvento } from '@/lib/diagnostico'

const LADO_MAX = 1920
const MP_MAX_SIN_REDUCCION = 50   // por encima de esto no se intenta decodificar el original completo
const BYTES_CABECERA = 256 * 1024

export type MetodoOptimizacion = 'imagedecoder' | 'bitmap' | 'original'

export interface InfoOptimizacion {
  mbOriginal: number
  megapixeles: number | null
  metodo: MetodoOptimizacion
  ms: number
  mbFinal: number
}

export interface ResultadoOptimizacion {
  file: File
  /** false = no se pudo optimizar y `file` es el original sin tocar. */
  optimizada: boolean
  info: InfoOptimizacion
}

function toJpeg(blob: File | Blob, originalName: string): File {
  const name = originalName.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], name, { type: 'image/jpeg' })
}

interface DimensionesJpeg {
  width: number
  height: number
  orientacion: number   // 1..8 (EXIF); 1 si no hay
}

// Lee ancho/alto (marcador SOF) y orientación EXIF del encabezado del JPEG sin
// decodificar la imagen. Devuelve null si no es JPEG o no se encuentra.
async function leerDimensionesJpeg(file: File): Promise<DimensionesJpeg | null> {
  try {
    const buf = await file.slice(0, BYTES_CABECERA).arrayBuffer()
    const v = new DataView(buf)
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null
    let orientacion = 1
    let pos = 2
    while (pos + 4 <= v.byteLength) {
      if (v.getUint8(pos) !== 0xff) { pos++; continue }
      const marcador = v.getUint8(pos + 1)
      if (marcador === 0xff) { pos++; continue }
      if (marcador === 0xd8 || marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) { pos += 2; continue }
      const largo = v.getUint16(pos + 2)
      if (marcador === 0xe1 && pos + 10 <= v.byteLength && v.getUint32(pos + 4) === 0x45786966) {
        orientacion = leerOrientacionExif(v, pos + 10, Math.min(v.byteLength, pos + 2 + largo)) ?? orientacion
      }
      const esSOF = marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc
      if (esSOF) {
        if (pos + 9 > v.byteLength) return null
        const height = v.getUint16(pos + 5)
        const width = v.getUint16(pos + 7)
        return width > 0 && height > 0 ? { width, height, orientacion } : null
      }
      pos += 2 + largo
    }
    return null
  } catch {
    return null
  }
}

function leerOrientacionExif(v: DataView, tiff: number, fin: number): number | null {
  if (tiff + 8 > fin) return null
  const little = v.getUint16(tiff) === 0x4949
  const u16 = (o: number) => v.getUint16(o, little)
  const u32 = (o: number) => v.getUint32(o, little)
  const ifd = tiff + u32(tiff + 4)
  if (ifd + 2 > fin) return null
  const n = u16(ifd)
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12
    if (e + 12 > fin) return null
    if (u16(e) === 0x0112) {
      const o = u16(e + 8)
      return o >= 1 && o <= 8 ? o : null
    }
  }
  return null
}

// Transformaciones estándar de canvas para orientaciones EXIF 2..8 (w, h = tamaño sin rotar).
function aplicarOrientacion(ctx: CanvasRenderingContext2D, o: number, w: number, h: number) {
  switch (o) {
    case 2: ctx.transform(-1, 0, 0, 1, w, 0); break
    case 3: ctx.transform(-1, 0, 0, -1, w, h); break
    case 4: ctx.transform(1, 0, 0, -1, 0, h); break
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break
    case 6: ctx.transform(0, 1, -1, 0, h, 0); break
    case 7: ctx.transform(0, -1, -1, 0, h, w); break
    case 8: ctx.transform(0, -1, 1, 0, 0, w); break
  }
}

function liberarCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

function canvasABlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
}

// a) ImageDecoder (WebCodecs): Chrome decodifica el JPEG ya reducido, sin cargar
// la imagen completa. Requiere conocer las dimensiones (encabezado JPEG).
async function reducirConImageDecoder(file: File, dim: DimensionesJpeg): Promise<Blob | null> {
  const ID = (globalThis as unknown as { ImageDecoder?: any }).ImageDecoder
  if (!ID) return null
  const tipo = file.type || 'image/jpeg'
  if (typeof ID.isTypeSupported === 'function' && !(await ID.isTypeSupported(tipo))) return null

  const escala = Math.min(1, LADO_MAX / Math.max(dim.width, dim.height))
  const srcW = Math.max(1, Math.round(dim.width * escala))
  const srcH = Math.max(1, Math.round(dim.height * escala))
  const transpuesta = dim.orientacion >= 5

  let decoder: any = null
  let frame: any = null
  const canvas = document.createElement('canvas')
  try {
    decoder = new ID({ data: file.stream(), type: tipo, desiredWidth: srcW, desiredHeight: srcH })
    frame = (await decoder.decode({ frameIndex: 0 })).image
    const fw: number = frame.displayWidth
    const fh: number = frame.displayHeight

    // ¿El decodificador ya aplicó la orientación? Solo se puede saber en las
    // transpuestas (5–8): el cuadro sale con ancho/alto invertidos respecto al SOF.
    const yaOrientada = transpuesta ? (fw >= fh) !== (dim.width >= dim.height) : true
    const rotarManual = !yaOrientada

    let cw: number, ch: number
    if (yaOrientada) {
      // Tamaño final: el pedido, intercambiado si la orientación es transpuesta.
      cw = transpuesta ? srcH : srcW
      ch = transpuesta ? srcW : srcH
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      canvas.width = cw
      canvas.height = ch
      ctx.drawImage(frame, 0, 0, cw, ch)
    } else {
      cw = transpuesta ? srcH : srcW
      ch = transpuesta ? srcW : srcH
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      if (rotarManual) aplicarOrientacion(ctx, dim.orientacion, srcW, srcH)
      ctx.drawImage(frame, 0, 0, srcW, srcH)
    }
    const blob = await canvasABlob(canvas)
    return blob && blob.size > 0 ? blob : null
  } catch {
    return null
  } finally {
    try { frame?.close() } catch { /* ignore */ }
    try { decoder?.close() } catch { /* ignore */ }
    liberarCanvas(canvas)
  }
}

// b) createImageBitmap con reducción y orientación EXIF.
async function reducirConBitmap(file: File, dim: DimensionesJpeg | null): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function') return null
  let bmp: ImageBitmap | null = null
  const canvas = document.createElement('canvas')
  try {
    const opts: ImageBitmapOptions = { resizeQuality: 'medium', imageOrientation: 'from-image' }
    if (dim) {
      const escala = Math.min(1, LADO_MAX / Math.max(dim.width, dim.height))
      const ow = dim.orientacion >= 5 ? dim.height : dim.width
      const oh = dim.orientacion >= 5 ? dim.width : dim.height
      opts.resizeWidth = Math.max(1, Math.round(ow * escala))
      opts.resizeHeight = Math.max(1, Math.round(oh * escala))
    } else {
      opts.resizeWidth = LADO_MAX
    }
    bmp = await createImageBitmap(file, opts)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    canvas.width = bmp.width
    canvas.height = bmp.height
    ctx.drawImage(bmp, 0, 0)
    const blob = await canvasABlob(canvas)
    return blob && blob.size > 0 ? blob : null
  } catch {
    return null
  } finally {
    bmp?.close()
    liberarCanvas(canvas)
  }
}

// Reduce primero a máx. 1920 px sin decodificar la foto completa.
async function prerreducir(
  file: File,
  dim: DimensionesJpeg | null,
): Promise<{ file: File; metodo: MetodoOptimizacion } | null> {
  if (file.size <= 1.5 * 1024 * 1024) return { file, metodo: 'original' }
  if (dim) {
    const blob = await reducirConImageDecoder(file, dim)
    if (blob) return { file: new File([blob], file.name, { type: 'image/jpeg' }), metodo: 'imagedecoder' }
  }
  const blob = await reducirConBitmap(file, dim)
  if (blob) return { file: new File([blob], file.name, { type: 'image/jpeg' }), metodo: 'bitmap' }
  return null
}

// Comprime una imagen hasta quedar bajo `limiteMB`. Intento primario: 1.5 MB /
// 1920 px; si aún supera el límite, segundo intento más agresivo. Si no se puede
// optimizar devuelve el original con `optimizada: false`.
export async function optimizarImagen(file: File, limiteMB = 5.5): Promise<ResultadoOptimizacion> {
  const t0 = performance.now()
  const dim = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name) ? await leerDimensionesJpeg(file) : null
  const megapixeles = dim ? Math.round((dim.width * dim.height) / 1e5) / 10 : null
  const info = (metodo: MetodoOptimizacion, final: File): InfoOptimizacion => ({
    mbOriginal: Math.round((file.size / 1048576) * 10) / 10,
    megapixeles,
    metodo,
    ms: Math.round(performance.now() - t0),
    mbFinal: Math.round((final.size / 1048576) * 10) / 10,
  })
  const sinOptimizar = (): ResultadoOptimizacion => ({ file, optimizada: false, info: info('original', file) })

  if (!file.type.startsWith('image/')) return sinOptimizar()
  const limiteBytes = limiteMB * 1024 * 1024
  try {
    const pre = await prerreducir(file, dim)
    // Foto enorme y sin reducción previa: decodificarla completa mata la pestaña.
    if (!pre && megapixeles !== null && megapixeles > MP_MAX_SIN_REDUCCION) return sinOptimizar()
    const fuente = pre?.file ?? file
    const metodo: MetodoOptimizacion = pre?.metodo ?? 'original'

    // La imagen ya mide ≤1920 px: sin web worker (no depende del CDN sin conexión).
    const out1 = await imageCompression(fuente, {
      maxSizeMB: 1.5,
      maxWidthOrHeight: LADO_MAX,
      useWebWorker: false,
      initialQuality: 0.8,
      fileType: 'image/jpeg',
    })
    const jpg1 = toJpeg(out1, file.name)
    if (jpg1.size <= limiteBytes) return { file: jpg1, optimizada: true, info: info(metodo, jpg1) }
    const out2 = await imageCompression(jpg1, {
      maxSizeMB: Math.min(0.8, limiteMB * 0.8),
      maxWidthOrHeight: 1280,
      useWebWorker: false,
      initialQuality: 0.7,
      fileType: 'image/jpeg',
    })
    const jpg2 = toJpeg(out2, file.name)
    return { file: jpg2, optimizada: true, info: info(metodo, jpg2) }
  } catch {
    return sinOptimizar()
  }
}

// Versión simple: siempre devuelve un File (el original si falla).
// Con `modulo`, una falla de optimización queda registrada en el diagnóstico.
export async function comprimirImagen(file: File, limiteMB = 5.5, modulo?: string): Promise<File> {
  const res = await optimizarImagen(file, limiteMB)
  if (modulo && !res.optimizada) registrarEvento(modulo, 'foto_fallo', { ...res.info, mensaje: 'no se pudo optimizar' })
  return res.file
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
