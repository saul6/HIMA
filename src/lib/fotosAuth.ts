// Fotos del login (carrusel de escritorio y fondo móvil): copias WebP ligeras
// en public/images/app/, con dos anchos para que el navegador elija por pantalla.
export type FotoAuth = 'campo' | 'invernadero' | 'empacadora' | 'cuartofrio' | 'almacen' | 'carnicos'

export const fotoAuthSrc = (n: FotoAuth) => `/images/app/${n}-1200.webp`
export const fotoAuthSrcSet = (n: FotoAuth) =>
  `/images/app/${n}-1200.webp 1200w, /images/app/${n}-2400.webp 2400w`
