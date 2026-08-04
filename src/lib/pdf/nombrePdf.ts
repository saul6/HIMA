export function nombrePdf(modulo: string, fechaISO: string, rancho?: string | null): string {
  const limpiar = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[/\\:*?"<>|]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')

  const partes = [modulo, fechaISO]
  if (rancho) {
    const r = limpiar(rancho)
    if (r) partes.push(r)
  }
  return partes.join('_') + '.pdf'
}
