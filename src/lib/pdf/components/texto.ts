/** Parte palabras muy largas (sin espacios) para que no se salgan de la celda en react-pdf. */
export const partirPalabraLarga = (palabra: string): string[] =>
  palabra.length > 24 ? (palabra.match(/.{1,24}/g) ?? [palabra]) : [palabra]
