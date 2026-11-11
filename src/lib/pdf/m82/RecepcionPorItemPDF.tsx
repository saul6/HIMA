// PDF M82 — Recepción diaria de fruta por ítem (formato PRO-02 por bloques). Diseño nuevo (lib/pdf/disenoNuevo).
// Una hoja por página del formato (bloques de la misma página van juntos); si un bloque rebasa su capacidad
// (columnas de ítem o renglones) salen hojas de continuación. Nunca se recortan datos.
import { Document, View, Text } from '@react-pdf/renderer'
import { PaginaEstandar, Seccion } from '@/lib/pdf/disenoNuevo/PaginaEstandar'
import { FranjaDatos } from '@/lib/pdf/disenoNuevo/Franja'
import { TablaDatos, type ColumnaDato, type CeldaDato } from '@/lib/pdf/disenoNuevo/TablaDatos'
import { PdfFirmas } from '@/lib/pdf/disenoNuevo/PdfFirmas'
import { codigoFormato } from '@/lib/codigoFormato'
import { PC } from '@/lib/pdf/components/tokens'
import { fechaPdf } from '@/lib/pdf/disenoNuevo/fechas'
import type { M82Bloque, M82Entrega, M82Item } from '@/hooks/useM82Recepcion'

export interface M82DatosPDF {
  orgNombre: string
  fecha: string
  empresa: string
  bloques: M82Bloque[]
  items: M82Item[]
  entregas: M82Entrega[]          // solo ACEPTADAS de esa empresa y fecha
  nombres: Record<string, string> // profile_id -> nombre de quien realizó
}

interface Renglon {
  hora: string
  productor: string
  clasif: string
  pase: boolean
  cajas: Map<string, number>
  be: boolean | null
  l: boolean | null
  lp: boolean | null
  quien: string
}

interface Segmento {
  bloque: M82Bloque
  codigos: string[]       // códigos de esta hoja (sin relleno)
  renglones: Renglon[]
  totDia: Map<string, number>
  totPase: Map<string, number>
  continuacion: number    // 0 = hoja principal
}

const chunk = <T,>(a: T[], n: number): T[][] => {
  if (a.length === 0) return [[]]
  const r: T[][] = []
  for (let i = 0; i < a.length; i += n) r.push(a.slice(i, i + n))
  return r
}

/** Total por código separando pase de andén (criterio pendiente de confirmar con el cliente; aislado aquí). */
function totales(renglones: Renglon[], codigos: string[]) {
  const dia = new Map<string, number>(), pase = new Map<string, number>()
  for (const c of codigos) { dia.set(c, 0); pase.set(c, 0) }
  for (const r of renglones) for (const c of codigos) {
    const v = r.cajas.get(c) ?? 0
    const m = r.pase ? pase : dia
    m.set(c, (m.get(c) ?? 0) + v)
  }
  return { dia, pase }
}

export function construirSegmentos(d: M82DatosPDF): Segmento[] {
  const ordenItem = new Map(d.items.map((i) => [i.codigo, i.orden]))
  const segs: Segmento[] = []
  for (const b of d.bloques) {
    const renglones: Renglon[] = []
    for (const e of d.entregas) {
      const porClasif = new Map<string, Map<string, number>>()
      for (const l of e.lineas) {
        if (l.bloque_clave !== b.clave) continue
        if ((l.cajas_confirmadas ?? 0) <= 0) continue   // ítem rechazado en papeleta de no conforme
        const cl = l.clasificacion ?? ''
        if (!porClasif.has(cl)) porClasif.set(cl, new Map())
        const m = porClasif.get(cl)!
        m.set(l.codigo, (m.get(l.codigo) ?? 0) + (l.cajas_confirmadas ?? 0))
      }
      for (const cl of ['CONV', 'ORG']) {
        const m = porClasif.get(cl)
        if (!m) continue
        renglones.push({
          hora: e.hora, productor: e.codigo_productor, clasif: cl === 'ORG' ? 'Org' : 'Conv', pase: e.pase_anden,
          cajas: m, be: e.limp_be, l: e.limp_l, lp: e.limp_lp, quien: d.nombres[e.creado_por ?? ''] ?? '',
        })
      }
    }
    // Solo bloques con fruta recibida: un producto sin entradas aceptadas no aparece en el PDF.
    if (renglones.length === 0) continue
    const codigos = Array.from(new Set(renglones.flatMap((r) => Array.from(r.cajas.keys()))))
      .sort((x, y) => (ordenItem.get(x) ?? 0) - (ordenItem.get(y) ?? 0))
    let n = 0
    for (const cods of chunk(codigos, b.max_columnas)) {
      const conDatos = renglones.filter((r) => cods.length === 0 || cods.some((c) => r.cajas.has(c)))
      const { dia, pase } = totales(conDatos, cods)
      for (const filas of chunk(conDatos, b.max_renglones)) {
        segs.push({ bloque: b, codigos: cods, renglones: filas, totDia: dia, totPase: pase, continuacion: n++ })
      }
    }
  }
  return segs
}

const siX = (v: boolean | null): CeldaDato =>
  v === true ? 'Si' : v === false ? { texto: 'X', color: PC.negativo, negrita: true } : ''

function TablaBloque({ s }: { s: Segmento }) {
  // Solo las columnas de ítems recibidos (sin columnas "#" vacías).
  const cols: (string | null)[] = s.codigos
  const anchoItem = s.bloque.max_columnas > 3 ? 34 : 54
  const columnas: ColumnaDato[] = [
    { texto: 'Hora', ancho: 38, align: 'center' },
    { texto: 'Código del productor', ancho: 62 },
    { texto: 'Orgánico / Convencional', ancho: 54, align: 'center' },
    { texto: 'Pase de andén', ancho: 38, align: 'center' },
    ...cols.map((c) => ({ texto: c ? `# ${c}` : '#', ancho: anchoItem, align: 'center' as const })),
    { texto: 'BE', ancho: 22, align: 'center' },
    { texto: 'L', ancho: 22, align: 'center' },
    { texto: 'LP', ancho: 22, align: 'center' },
    { texto: 'Quién realiza', ancho: 80 },
  ]
  const filas: CeldaDato[][] = s.renglones.map((r) => [
    r.hora, r.productor, r.clasif, r.pase ? 'X' : '',
    ...cols.map((c) => (c && r.cajas.has(c) ? String(r.cajas.get(c)) : '')),
    siX(r.be), siX(r.l), siX(r.lp), r.quien,
  ])
  const colsTot: ColumnaDato[] = [
    { texto: 'Inventario total', ancho: 150 },
    ...cols.map((c) => ({ texto: c ? `# ${c}` : '#', ancho: anchoItem, align: 'center' as const })),
  ]
  const filasTot: CeldaDato[][] = [
    ['Recepción del día', ...cols.map((c) => (c ? String(s.totDia.get(c) ?? 0) : ''))],
    ['Pase aduanal', ...cols.map((c) => (c ? String(s.totPase.get(c) ?? 0) : ''))],
  ]
  const titulo = `ENTRADA · PRODUCTO: ${s.bloque.titulo}${s.continuacion > 0 ? ` · CONTINUACIÓN ${s.continuacion}` : ''}`
  return (
    <Seccion titulo={titulo}>
      <TablaDatos columnas={columnas} filas={filas} fuente={7.5} vacio="Sin entradas aceptadas en este bloque" />
      <View style={{ marginTop: 6, width: 150 + anchoItem * Math.max(cols.length, 1) }}>
        <TablaDatos columnas={colsTot} filas={filasTot} fuente={7.5} encabezadoFijo={false}
          anchoTotal={150 + anchoItem * Math.max(cols.length, 1)} />
      </View>
    </Seccion>
  )
}

export function RecepcionPorItemPDF({ d, codigoClave }: { d: M82DatosPDF; codigoClave: string }) {
  const codigoFmt = codigoFormato('F-FRUS-PRO-02', codigoClave)
  const segs = construirSegmentos(d)
  // Hojas: principales agrupadas por página del formato; cada continuación en su propia hoja.
  const hojas: Segmento[][] = []
  const porPagina = new Map<number, Segmento[]>()
  for (const s of segs) {
    if (s.continuacion === 0) {
      if (!porPagina.has(s.bloque.pagina)) { const g: Segmento[] = []; porPagina.set(s.bloque.pagina, g); hojas.push(g) }
      porPagina.get(s.bloque.pagina)!.push(s)
    } else {
      hojas.push([s])
    }
  }
  const obs = d.entregas.filter((e) => e.observaciones).map((e) => `${e.hora} · ${e.observaciones}`).join('\n')
  const fecha = fechaPdf(d.fecha)

  return (
    <Document>
      {hojas.map((grupo, i) => {
        const ultima = i === hojas.length - 1
        return (
          <PaginaEstandar
            key={i}
            trio={false}
            titulo="RECEPCIÓN DIARIA DE FRUTA"
            subtitulo={d.orgNombre}
            codigoFmt={codigoFmt}
            folio={fecha}
            emision={fecha}
            detalleCompacto={`${codigoFmt}  |  ${d.empresa}  |  ${fecha}`}
            camposDatos={[
              { icono: 'codigo', etiqueta: 'Formato', valor: codigoFmt },
              { etiqueta: 'Empresa', valor: d.empresa },
              { icono: 'calendario', etiqueta: 'Fecha', valor: fecha },
              { etiqueta: 'Hoja', valor: `${i + 1} de ${hojas.length}` },
            ]}
          >
            {grupo.map((s, j) => <TablaBloque key={j} s={s} />)}
            {ultima ? (
              <View wrap={false}>
                {obs ? <FranjaDatos campos={[{ etiqueta: 'Observaciones', valor: obs }]} anchoTotal={841.89 - 80} /> : null}
                <Text style={{ fontSize: 6.5, color: PC.textSub, marginBottom: 6 }}>
                  BE: buen estado · L: limpio · LP: libre de plagas. Si = cumple; X = no cumple. En caso de encontrar alguna plaga la carga no será recibida.
                  Se deberá especificar en la recepción de fruta diariamente los datos solicitados en dicho formato, especificando si la fruta es Orgánica (Org) o Convencional (Conv.) o si es fruta de pase de andén.
                </Text>
                <PdfFirmas
                  signatures={[
                    { label: '', nombre: '', caption: `Aprobó Responsable ${d.orgNombre}`, firma: null },
                    { label: '', nombre: '', caption: 'Responsable Empresa', firma: null },
                  ]}
                />
              </View>
            ) : null}
          </PaginaEstandar>
        )
      })}
    </Document>
  )
}
