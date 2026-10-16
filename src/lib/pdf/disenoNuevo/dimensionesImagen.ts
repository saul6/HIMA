// Ancho y alto reales de una imagen embebida como data URI (JPEG o PNG), leídos
// del encabezado sin decodificar los píxeles. Sirve para calcular el alto de
// cada incidencia en el PDF antes de dibujarla. null si no se puede leer.
export function dimensionesDeDataUri(uri: string): { w: number; h: number } | null {
  try {
    const coma = uri.indexOf(',')
    if (coma < 0) return null
    const bin = atob(uri.slice(coma + 1))
    const b = (i: number) => bin.charCodeAt(i)
    // PNG: firma 89 50 4E 47; IHDR con ancho/alto en los bytes 16-23
    if (b(0) === 0x89 && b(1) === 0x50) {
      const w = (b(16) << 24) | (b(17) << 16) | (b(18) << 8) | b(19)
      const h = (b(20) << 24) | (b(21) << 16) | (b(22) << 8) | b(23)
      return w > 0 && h > 0 ? { w, h } : null
    }
    // JPEG: buscar el marcador SOFn (C0-CF salvo C4, C8, CC)
    if (b(0) !== 0xff || b(1) !== 0xd8) return null
    let i = 2
    while (i + 9 < bin.length) {
      if (b(i) !== 0xff) { i++; continue }
      const m = b(i + 1)
      if (m === 0xff) { i++; continue }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        const h = (b(i + 5) << 8) | b(i + 6)
        const w = (b(i + 7) << 8) | b(i + 8)
        return w > 0 && h > 0 ? { w, h } : null
      }
      i += 2 + ((b(i + 2) << 8) | b(i + 3))
    }
    return null
  } catch {
    return null
  }
}
