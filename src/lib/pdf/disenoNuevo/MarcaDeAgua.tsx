// Marca de agua: isotipo a color centrado, ~42 % del lado corto de la hoja A4
// (595 pt → 250 pt, tanto en vertical como en horizontal). Va como primer hijo
// de <Page>; react-pdf incrusta la imagen una sola vez por documento.
import { View, Image } from '@react-pdf/renderer'
import { ISOTIPO_MARCA_AGUA } from './isotipoMarcaAgua'

const MARCA_AGUA_W = 250

export function MarcaDeAgua() {
  return (
    <View
      fixed
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
    >
      <Image src={ISOTIPO_MARCA_AGUA} style={{ width: MARCA_AGUA_W, height: MARCA_AGUA_W, opacity: 0.07 }} />
    </View>
  )
}
