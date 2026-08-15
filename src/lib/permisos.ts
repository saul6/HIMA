// TEMPORAL: usuario de pruebas — permite fechas pasadas en módulos con candado.
// Revertir junto con la excepción en BD cuando terminen las pruebas de hizaelgaribay@mady.com.mx
export const puedeEditarFechaLibre = (email?: string | null): boolean =>
  email === 'hizaelgaribay@mady.com.mx'
