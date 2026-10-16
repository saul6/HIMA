// PATRÓN INOCUIDAD — PDF M25 (plantilla homogénea M.A.D.Y)
// Resumen de No-Conformidades — A4 portrait, multi-página.
// Encabezado fijo repetido (TopBar + logo + meta), PdfSectionBanner, PdfFooter.

import { Document, View, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { TablaDatos, ANCHO_UTIL, type ColumnaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { PC } from '@/lib/pdf/components/tokens'
import { partirPalabraLarga } from '@/lib/pdf/components/texto'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface NcrFila {
  ncr: number
  modulo: string
  codigo_pregunta: string
  seccion: string
  texto_pregunta: string
  comentario: string
}

export interface ResumenNoConformidadesPDFProps {
  orgNombre: string
  ranchoNombre: string
  fecha: string
  auditorNombre: string
  clienteNombre: string
  paPgfs: string | null
  ncrs: NcrFila[]
  notaPlazo?: string
  terminoSitio?: string
}

// ── Constantes ────────────────────────────────────────────────────────────────

const NOTE_DEFAULT =
  'Las no-conformidades deben atenderse en un maximo de 30 dias naturales a partir de la fecha de auditoria.'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFechaPDF(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch { return iso }
}

// ── Columnas (anchos relativos; la tabla se escala al ancho útil de la hoja) ───

const COLS: ColumnaDato[] = [
  { texto: 'No.', ancho: 42, align: 'center' },
  { texto: 'Modulo / Seccion / Pregunta', ancho: 236 },
  { texto: 'Descripcion de la no-conformidad', ancho: 236 },
]

// ── ResumenNoConformidadesPDF ─────────────────────────────────────────────────

export function ResumenNoConformidadesPDF({
  orgNombre,
  ranchoNombre,
  fecha,
  auditorNombre,
  clienteNombre,
  paPgfs,
  ncrs,
  notaPlazo = NOTE_DEFAULT,
  terminoSitio = 'Instalación',
}: ResumenNoConformidadesPDFProps) {
  const emision = new Date().toLocaleDateString('es-MX')
  const fechaFormateada = formatFechaPDF(fecha)

  return (
    <Document
      title={`Resumen_No_Conformidades_${fecha}`}
      author="M.A.D.Y."
      creator="M.A.D.Y. Inocuidad Inteligente"
      producer="M.A.D.Y. Inocuidad Inteligente"
      subject="Resumen de No-Conformidades PrimusGFS"
      keywords="MADY, inocuidad, no-conformidades, auditoria"
    >
      <PaginaEstandar
        orientacion="portrait"
        trio={false}
        titulo="RESUMEN DE NO-CONFORMIDADES"
        subtitulo={`Acciones correctivas  ·  ${terminoSitio}: ${ranchoNombre}`}
        codigoFmt="M25"
        folio={emision}
        emision={emision}
        detalleCompacto={`Emision: ${emision}  ·  Fecha de auditoria: ${fechaFormateada}  ·  Auditor: ${auditorNombre || '—'}${paPgfs ? `  ·  PA-PGFS: ${paPgfs}` : ''}`}
        camposDatos={[
          { icono: 'calendario', etiqueta: 'Emision', valor: emision },
          { icono: 'calendario', etiqueta: 'Fecha de auditoria', valor: fechaFormateada },
          { icono: 'usuario', etiqueta: 'Auditor', valor: auditorNombre || '—' },
          ...(paPgfs ? [{ icono: 'folio' as const, etiqueta: 'PA-PGFS', valor: paPgfs }] : []),
        ]}
      >
        <Seccion titulo="1. INFORMACION GENERAL">
          <FranjaDatos
            porRenglon={3}
            campos={[
              { icono: 'usuario', etiqueta: 'Organizacion', valor: orgNombre },
              { icono: 'ubicacion', etiqueta: `Operacion / ${terminoSitio}`, valor: ranchoNombre },
              { icono: 'calendario', etiqueta: 'Fecha de auditoria', valor: fechaFormateada },
              { icono: 'usuario', etiqueta: 'Auditor', valor: auditorNombre || '—' },
              { icono: 'usuario', etiqueta: 'Cliente / representante', valor: clienteNombre || '—' },
              { etiqueta: 'Total de no-conformidades', valor: `${ncrs.length} NCR${ncrs.length !== 1 ? 's' : ''}`, colorValor: PC.negativo },
            ]}
          />
        </Seccion>

        <Seccion titulo="2. NO-CONFORMIDADES DETECTADAS">
          <TablaDatos
            columnas={COLS}
            anchoTotal={ANCHO_UTIL.portrait}
            vacio="Sin no-conformidades en esta visita"
            filas={ncrs.map((ncr) => [
              { texto: `NCR${ncr.ncr}`, color: PC.negativo, negrita: true },
              {
                nodo: (
                  <>
                    <Text style={{ fontSize: 7, color: PC.textSub, fontFamily: 'Helvetica-Bold' }} hyphenationCallback={partirPalabraLarga}>
                      {ncr.modulo.toUpperCase()} — {ncr.seccion}
                    </Text>
                    <Text style={{ fontSize: 7, color: PC.textSub, marginTop: 1 }}>{ncr.codigo_pregunta}</Text>
                    <Text style={{ fontSize: 8, color: PC.fieldValue, marginTop: 2 }} hyphenationCallback={partirPalabraLarga}>{ncr.texto_pregunta}</Text>
                  </>
                ),
              },
              ncr.comentario || '—',
            ])}
          />
        </Seccion>

        {/* Nota de plazo */}
        <View wrap={false} style={{ marginBottom: 10, padding: 8, borderRadius: 6, backgroundColor: PC.m13Fondo }}>
          <Text style={{ fontSize: 7, color: PC.textSub, lineHeight: 1.4 }}>Nota: {notaPlazo}</Text>
        </View>

        <View wrap={false}>
          <Seccion titulo="3. FIRMAS">
            <PdfFirmas
              signatures={[
                { label: '', nombre: clienteNombre || '', caption: 'Firma del Cliente' },
                { label: '', nombre: auditorNombre || '', caption: 'Firma del Auditor' },
              ]}
            />
          </Seccion>
        </View>
      </PaginaEstandar>
    </Document>
  )
}
