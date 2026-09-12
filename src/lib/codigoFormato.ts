export function codigoFormato(code: string, clave: string): string {
  if (!clave) return code
  return code.replace(/F-FRUS-/g, `F-${clave}-`)
}
