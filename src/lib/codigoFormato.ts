export function codigoFormato(code: string, clave: string): string {
  return code.replace(/F-FRUS-/g, `F-${clave}-`)
}
