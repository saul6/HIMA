// Orden alfabético es-MX para listas visibles al usuario (categorías, módulos,
// resultados de búsqueda). Ignora acentos/mayúsculas, pone la ñ después de la
// n, y compara números como humano ("2" antes de "10").
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

export function ordenarAlfabetico<T>(items: T[], obtenerTexto: (item: T) => string): T[] {
  return [...items].sort((a, b) => collator.compare(obtenerTexto(a), obtenerTexto(b)))
}
