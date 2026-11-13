// PDF M84 — Papeleta de producto no conforme (formato PRO-07). Una hoja por papeleta. Diseño nuevo (lib/pdf/disenoNuevo).
import { Document, View, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'
import type { M84Papeleta } from '@/hooks/useM84NoConforme'

const TZ = 'America/Mexico_City'
const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }) : '')
const dia = (iso: string | null) => (iso ? fechaPdf(new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })) : '')

/** Firma del diseño estándar (PdfFirmas): nombre sobre la línea y rótulo debajo; sin firma digital, la línea queda para firma a mano. */
function LineaFirma({ etiqueta, nombre }: { etiqueta: string; nombre: string | null }) {
  return (
    <View style={{ width: 260 }}>
      <PdfFirmas signatures={[{ label: '', nombre: nombre ?? '', caption: etiqueta, firma: null }]} />
    </View>
  )
}

export function ProductoNoConformePDF({ papeletas, orgNombre, codigoClave }: { papeletas: M84Papeleta[]; orgNombre: string; codigoClave: string }) {
  const codigoFmt = codigoFormato('F-FRUS-PRO-07', codigoClave)
  return (
    <Document>
      {papeletas.map((p) => {
        const resultado = p.estado === 'RETENIDA' ? 'Pendiente de dictamen' : p.estado === 'LIBERADA' ? 'Liberada' : 'Rechazada'
        return (
          <PaginaEstandar
            key={p.id}
            orientacion="portrait"
            trio={false}
            titulo="PRODUCTO NO CONFORME"
            subtitulo={orgNombre}
            codigoFmt={codigoFmt}
            folio={dia(p.retenida_en)}
            emision={dia(p.retenida_en)}
            detalleCompacto={`${codigoFmt}  |  ${p.empresa}  |  ${dia(p.retenida_en)}`}
            camposDatos={[
              { icono: 'codigo', etiqueta: 'Formato', valor: codigoFmt },
              { etiqueta: 'Origen', valor: p.origen === 'INGRESO' ? 'Retención al ingreso' : 'Retención posterior' },
              { etiqueta: 'Estado', valor: resultado, colorValor: p.estado === 'RECHAZADA' ? PC.negativo : undefined },
            ]}
          >
            <Seccion titulo="RETENCIÓN">
              <FranjaDatos porRenglon={3} campos={[
                { etiqueta: 'Empresa', valor: p.empresa },
                { etiqueta: 'Hora', valor: hora(p.retenida_en) },
                { icono: 'calendario', etiqueta: 'Fecha', valor: dia(p.retenida_en) },
                { etiqueta: 'Código', valor: p.codigo },
                { etiqueta: 'Embalaje', valor: p.embalaje },
                { etiqueta: 'N° Cajas', valor: String(p.cajas) },
              ]} />
              <FranjaDatos porRenglon={1} campos={[{ etiqueta: 'Motivo de la retención', valor: p.motivo }]} />
              <LineaFirma etiqueta="Firma de quien retiene en Calidad" nombre={p.retiene_nombre} />
            </Seccion>
            {/* El dictamen corto va completo en la misma hoja; uno largo se parte por su texto. */}
            <View {...((p.dictamen?.length ?? 0) + (p.disposicion?.length ?? 0) < 400 ? { wrap: false } : {})} style={{ marginTop: 18 }}>
              <Seccion titulo="DICTAMEN">
                <FranjaDatos porRenglon={3} campos={[
                  { icono: 'calendario', etiqueta: 'Fecha', valor: dia(p.dictamen_en) || ' ' },
                  { etiqueta: 'Hora', valor: hora(p.dictamen_en) || ' ' },
                  { etiqueta: 'Resultado', valor: p.estado === 'RETENIDA' ? ' ' : resultado, colorValor: p.estado === 'RECHAZADA' ? PC.negativo : undefined },
                ]} />
                <FranjaDatos porRenglon={1} campos={[
                  { etiqueta: 'Dictamen', valor: p.dictamen ?? ' ' },
                  ...(p.disposicion ? [{ etiqueta: 'Devolución o disposición', valor: p.disposicion }] : []),
                ]} />
                <LineaFirma etiqueta="Firma de quien libera en Calidad" nombre={p.libera_nombre} />
              </Seccion>
            </View>
          </PaginaEstandar>
        )
      })}
    </Document>
  )
}
