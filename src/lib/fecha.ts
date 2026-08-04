// 'YYYY-MM-DD' del día actual en zona horaria de México.
// Usar esta función (no new Date().toISOString()) en todos los campos de fecha
// que van al BD, ya que el candado FECHA_SOLO_HOY compara contra la fecha en
// America/Mexico_City. toISOString() devuelve UTC, que por la noche en México
// ya cae en el día siguiente.
export const hoyMX = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
