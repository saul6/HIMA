// Nombre de archivo de PDF: `${modulo}_${fecha}.pdf`.
// CLAUDE.md §1: nunca se incluye el nombre del rancho/instalación. El tercer parámetro
// se conserva solo por compatibilidad con los generadores existentes y se ignora.
export function nombrePdf(modulo: string, fechaISO: string, _rancho?: string | null): string {
  return `${modulo}_${fechaISO}.pdf`
}
