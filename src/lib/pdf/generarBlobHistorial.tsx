// Blob generators for BibliotecaHistorial — one per module.
// Each returns a Blob without triggering a download.
// mergePDFBlobs() combines multiple Blobs into one using pdf-lib.

import { pdf } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
import { supabase } from '@/lib/supabase'
import { AplicacionPDF } from './AplicacionPDF'
import { BotiquinPDF } from './m6/BotiquinPDF'
import { VidrioPlasticoPDF } from './m7/VidrioPlasticoPDF'
import { FertilizacionPDF } from './m8/FertilizacionPDF'
import { PerimetralPDF } from './m9/PerimetralPDF'
import { CosechaLiberacionPDF } from './m10/CosechaLiberacionPDF'
import { PreoperacionalPDF } from './m11/PreoperacionalPDF'
import { InspeccionPreoperacionalCoolerPDF } from './m19/InspeccionPreoperacionalCoolerPDF'
import { LimpiezaBanosPDF } from './m12/LimpiezaBanosPDF'
import { ReporteIncidenciasPDF } from './m13/ReporteIncidenciasPDF'
import { fotosADataUris } from './m13/incidenciasPdfImagenes'
import { getAplicacionRicaById } from '@/lib/queries'
import { construirDatosPagina as construirDatosPerimetral } from './m9/generarPerimetralPDF'
import { construirDatosPagina as construirDatosPreoperacional } from './m11/generarPreoperacionalPDF'
import { construirDatosPaginaM19 } from './m19/generarInspeccionPreoperacionalCoolerPDF'
import { generarBlobAuditoria } from './auditoria/generarAuditoriaPDF'
import { generarBlobAccidenteLaboral } from './m20/generarAccidenteLaboralPDF'
import { generarBlobMonitoreoEstaciones } from './m21/generarMonitoreoEstacionesPDF'
import { generarBlobMuestrasLaboratorio } from './m22/generarMuestrasLaboratorioPDF'
import { generarBlobVerificacionInsumos } from './m23/generarVerificacionInsumosPDF'
import { generarBlobInventarioQuimicos } from './m24/generarInventarioQuimicosPDF'
import { generarBlobResumenNoConformidades } from './m25/generarResumenNoConformidadesPDF'
import { generarBlobAccionCorrectiva } from './m26/generarAccionesCorrectivasPDF'
import { generarBlobPreparacionCloro } from './m27/generarPreparacionCloroPDF'
import { generarBlobLimpiezaBanosQuimicos } from './m28/generarLimpiezaBanosQuimicosPDF'
import { generarBlobLimpiezaAduana } from './m29/generarLimpiezaAduanaPDF'
import { generarBlobLimpiezaComedor } from './m30/generarLimpiezaComedorPDF'
import { generarBlobLimpiezaOficinas } from './m31/generarLimpiezaOficinasPDF'
import { generarBlobLimpiezaPatiosAzoteas } from './m32/generarLimpiezaPatiosAzoteasPDF'
import { generarBlobLimpiezaRecepcion } from './m33/generarLimpiezaRecepcionPDF'
import { generarBlobLimpiezaPreenfrio } from './m34/generarLimpiezaPreenfrioPDF'
import { generarBlobLimpiezaAlmacenEmpaque } from './m35/generarLimpiezaAlmacenEmpaquePDF'
import { generarBlobMonitoreoGermicida } from './m36/generarMonitoreoGermicidaPDF'
import { generarBlobLimpiezaCisterna } from './m37/generarLimpiezaCisternaPDF'
import { generarBlobManifiestoEmbarque } from './m38/generarManifiestoEmbarquePDF'
import { generarBlobRecepcionFruta } from './m39/generarRecepcionFrutaPDF'
import { generarBlobEntradasSalidasPreFrio } from './m40/generarEntradasSalidasPreFrioPDF'
import { generarBlobTemperaturaConservador } from './m41/generarTemperaturaConservadorPDF'
import { generarBlobMaterialEmpaque } from './m42/generarMaterialEmpaquePDF'
import { generarBlobInspeccionAlmacenEmpaque } from './m43/generarInspeccionAlmacenEmpaquePDF'
import { generarBlobOrdenMantenimiento } from './m44/generarOrdenMantenimientoPDF'
import { generarBlobMttoPreventivo } from './m45/generarMttoPreventivoPDF'
import { generarBlobRondinesVigilancia } from './m46/generarRondinesVigilanciaPDF'

// ── Tipos públicos ────────────────────────────────────────────────────────────

export type ModuloKey = 'M1' | 'M6' | 'M7' | 'M8' | 'M9' | 'M10' | 'M11' | 'M12' | 'M13' | 'M14' | 'M15' | 'M16' | 'M17' | 'M18' | 'M19' | 'M20' | 'M21' | 'M22' | 'M23' | 'M24' | 'M25' | 'M26' | 'M27' | 'M28' | 'M29' | 'M30' | 'M31' | 'M32' | 'M33' | 'M34' | 'M35' | 'M36' | 'M37' | 'M38' | 'M39' | 'M40' | 'M41' | 'M42' | 'M43' | 'M44' | 'M45' | 'M46'

export type PDFRef =
  | { tipo: 'M1'; id: string }
  | { tipo: 'M6'; id: string }
  | { tipo: 'M7' | 'M8' | 'M10' | 'M12'; ranchoId: string; fecha: string }
  | { tipo: 'M9' | 'M11' | 'M19'; id: string }
  | { tipo: 'M13'; id: string }
  | { tipo: 'M14' | 'M15' | 'M16' | 'M17' | 'M18'; id: string }
  | { tipo: 'M20'; id: string }
  | { tipo: 'M21'; id: string }
  | { tipo: 'M22'; id: string }
  | { tipo: 'M23'; id: string }
  | { tipo: 'M24'; id: string }
  | { tipo: 'M25'; id: string }
  | { tipo: 'M26'; id: string }
  | { tipo: 'M27'; id: string }
  | { tipo: 'M28'; id: string }
  | { tipo: 'M29'; id: string }
  | { tipo: 'M30'; id: string }
  | { tipo: 'M31'; id: string }
  | { tipo: 'M32'; id: string }
  | { tipo: 'M33'; id: string }
  | { tipo: 'M34'; id: string }
  | { tipo: 'M35'; id: string }
  | { tipo: 'M36'; id: string }
  | { tipo: 'M37'; id: string }
  | { tipo: 'M38'; id: string }
  | { tipo: 'M39'; id: string }
  | { tipo: 'M40'; id: string }
  | { tipo: 'M41'; id: string }
  | { tipo: 'M42'; id: string }
  | { tipo: 'M43'; id: string }
  | { tipo: 'M44'; id: string }
  | { tipo: 'M45'; id: string }
  | { tipo: 'M46'; id: string }

export interface RegistroHistorial {
  key: string
  modulo: ModuloKey
  rancho_id: string | null
  rancho_nombre: string
  fecha: string
  resumen: string
  pdfRef: PDFRef
}

// ── Blob generators por módulo ────────────────────────────────────────────────

async function generarBlobM1(id: string): Promise<Blob> {
  const app = await getAplicacionRicaById(id)
  const a = app as any
  return pdf(
    <AplicacionPDF
      aplicacion={a}
      productos={a.aplicacion_productos ?? []}
      rancho={a.ranchos}
      asesor={a.asesor}
      responsable={a.responsable}
      operario={a.productores?.profiles ?? { nombre_completo: '—' }}
    />
  ).toBlob()
}

async function generarBlobM6(id: string, orgId: string): Promise<Blob> {
  const { data, error } = await supabase
    .from('m6_botiquin')
    .select('*, ranchos(nombre, codigo), profiles!responsable_id(nombre_completo)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (error) throw error
  const r = data as any
  return pdf(
    <BotiquinPDF
      folio={id.slice(0, 8).toUpperCase()}
      rancho={r.ranchos?.nombre ?? '—'}
      ranchoCodigo={r.ranchos?.codigo ?? '—'}
      fechaVerificacion={r.fecha_verificacion}
      parches_curitas={r.parches_curitas}
      guantes_curacion={r.guantes_curacion}
      vendas_tijeras={r.vendas_tijeras}
      gasas_cinta={r.gasas_cinta}
      desinfectante={r.desinfectante}
      responsableNombre={r.profiles?.nombre_completo ?? '—'}
    />
  ).toBlob()
}

async function generarBlobM7(ranchoId: string, fecha: string, orgId: string): Promise<Blob> {
  const { data, error } = await supabase
    .from('m7_vidrio_plastico')
    .select('*, ranchos(nombre, codigo)')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .eq('fecha', fecha)
    .order('created_at', { ascending: true })
  if (error) throw error
  if (!data?.length) throw new Error('Sin datos M7')
  const r0 = data[0] as any
  return pdf(
    <VidrioPlasticoPDF
      folio={(r0.id as string).slice(0, 8).toUpperCase()}
      rancho={r0.ranchos?.nombre ?? '—'}
      ranchoCodigo={r0.ranchos?.codigo ?? '—'}
      fecha={fecha}
      responsableNombre='—'
      materiales={(data as any[]).map((m) => ({
        area: m.area,
        material_equipo: m.material_equipo,
        protegido: m.protegido,
        estado: m.estado,
        observaciones: m.observaciones,
      }))}
    />
  ).toBlob()
}

async function generarBlobM8(ranchoId: string, fecha: string, orgId: string): Promise<Blob> {
  const { data, error } = await supabase
    .from('m8_fertilizacion')
    .select('*, ranchos(nombre, codigo)')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .eq('fecha', fecha)
    .order('created_at', { ascending: true })
  if (error) throw error
  if (!data?.length) throw new Error('Sin datos M8')
  const r0 = data[0] as any
  return pdf(
    <FertilizacionPDF
      folio={(r0.id as string).slice(0, 8).toUpperCase()}
      rancho={r0.ranchos?.nombre ?? '—'}
      ranchoCodigo={r0.ranchos?.codigo ?? '—'}
      fecha={fecha}
      sector={r0.sector}
      responsableNombre='—'
      fertilizantes={(data as any[]).map((f) => ({
        nombre_comercial: f.nombre_comercial,
        ingrediente_activo: f.ingrediente_activo,
        concentracion: f.concentracion,
        metodo: f.metodo,
        superficie_ha: f.superficie_ha,
        dosis_kg_l_ha: f.dosis_kg_l_ha,
        cantidad_total: f.cantidad_total,
      }))}
    />
  ).toBlob()
}

async function generarBlobM9(id: string, orgId: string): Promise<Blob> {
  const datos = await construirDatosPerimetral(id, orgId)
  return pdf(<PerimetralPDF {...datos} />).toBlob()
}

async function generarBlobM10(ranchoId: string, fecha: string, orgId: string): Promise<Blob> {
  const { data, error } = await supabase
    .from('m10_cosecha_liberacion')
    .select('*, ranchos(nombre, codigo), encargado:profiles!encargado_liberacion_id(nombre_completo)')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .eq('fecha', fecha)
    .order('created_at', { ascending: true })
  if (error) throw error
  if (!data?.length) throw new Error('Sin datos M10')
  const r0 = data[0] as any
  return pdf(
    <CosechaLiberacionPDF
      rancho={r0.ranchos?.nombre ?? '—'}
      ranchoCodigo={r0.ranchos?.codigo ?? '—'}
      fecha={fecha}
      liberaciones={(data as any[]).map((lib) => ({
        sector: lib.sector,
        cantidad_bandejas: lib.cantidad_bandejas,
        lote_liberado: lib.lote_liberado,
        numero_comprobante: lib.numero_comprobante,
        codigo_trazabilidad: lib.codigo_trazabilidad,
        marca_embalaje: lib.marca_embalaje,
        destino_final: lib.destino_final,
        fruta_proceso_kg: lib.fruta_proceso_kg,
        encargado_nombre: (lib.encargado as any)?.nombre_completo ?? null,
        verificacion_semanal: lib.verificacion_semanal,
        hora_inicio_cosecha: lib.hora_inicio_cosecha,
        hora_fin_cosecha: lib.hora_fin_cosecha,
        observaciones: lib.observaciones,
      }))}
    />
  ).toBlob()
}

async function generarBlobM11(id: string, orgId: string): Promise<Blob> {
  const datos = await construirDatosPreoperacional(id, orgId)
  return pdf(<PreoperacionalPDF {...datos} />).toBlob()
}

async function generarBlobM19(id: string, orgId: string, codigoClave: string): Promise<Blob> {
  const datos = await construirDatosPaginaM19(id, orgId)
  return pdf(<InspeccionPreoperacionalCoolerPDF {...datos} codigoClave={codigoClave} />).toBlob()
}

async function generarBlobM12(ranchoId: string, fecha: string, orgId: string): Promise<Blob> {
  const { data, error } = await supabase
    .from('m12_limpieza_banos')
    .select('*, ranchos(nombre, codigo)')
    .eq('org_id', orgId)
    .eq('rancho_id', ranchoId)
    .eq('fecha', fecha)
    .order('created_at', { ascending: true })
  if (error) throw error
  if (!data?.length) throw new Error('Sin datos M12')
  const r0 = data[0] as any
  return pdf(
    <LimpiezaBanosPDF
      rancho={r0.ranchos?.nombre ?? '—'}
      ranchoCodigo={r0.ranchos?.codigo ?? '—'}
      fecha={fecha}
      banos={(data as any[]).map((b) => ({
        bano_numero: b.bano_numero,
        limpieza: b.limpieza,
        desinfeccion: b.desinfeccion,
        concentracion_ppm: b.concentracion_ppm,
        sustancias: b.sustancias ?? [],
        abasto_papel: b.abasto_papel,
        succion: b.succion,
      }))}
    />
  ).toBlob()
}

async function generarBlobM13(id: string, orgId: string): Promise<Blob> {
  const { data, error } = await supabase
    .from('m13_reportes')
    .select(`
      id, fecha, auditor_nombre,
      ranchos(nombre, codigo),
      m13_incidencias(
        id, orden, descripcion,
        m13_incidencia_fotos(id, storage_path, orden)
      )
    `)
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (error) throw error

  const r = data as any
  const todosLosPaths: string[] = []
  for (const inc of (r.m13_incidencias ?? []) as any[]) {
    for (const f of (inc.m13_incidencia_fotos ?? []) as any[]) {
      todosLosPaths.push(f.storage_path)
    }
  }
  const urisPorPath = await fotosADataUris(todosLosPaths)

  const incidencias = ((r.m13_incidencias ?? []) as any[])
    .sort((a: any, b: any) => a.orden - b.orden)
    .map((inc: any) => ({
      orden: inc.orden,
      descripcion: inc.descripcion,
      dataUris: ((inc.m13_incidencia_fotos ?? []) as any[])
        .sort((a: any, b: any) => a.orden - b.orden)
        .map((f: any) => urisPorPath[f.storage_path] ?? ''),
    }))

  return pdf(
    <ReporteIncidenciasPDF
      folio={id.slice(0, 8).toUpperCase()}
      rancho={(r.ranchos as any)?.nombre ?? '—'}
      ranchoCodigo={(r.ranchos as any)?.codigo ?? '—'}
      fecha={r.fecha}
      auditorNombre={r.auditor_nombre ?? null}
      incidencias={incidencias}
    />
  ).toBlob()
}

// ── Generador unificado ───────────────────────────────────────────────────────

export async function generarBlobParaRef(ref: PDFRef, orgId: string, codigoClave: string): Promise<Blob> {
  switch (ref.tipo) {
    case 'M1':  return generarBlobM1(ref.id)
    case 'M6':  return generarBlobM6(ref.id, orgId)
    case 'M7':  return generarBlobM7(ref.ranchoId, ref.fecha, orgId)
    case 'M8':  return generarBlobM8(ref.ranchoId, ref.fecha, orgId)
    case 'M9':  return generarBlobM9(ref.id, orgId)
    case 'M10': return generarBlobM10(ref.ranchoId, ref.fecha, orgId)
    case 'M11': return generarBlobM11(ref.id, orgId)
    case 'M19': return generarBlobM19(ref.id, orgId, codigoClave)
    case 'M12': return generarBlobM12(ref.ranchoId, ref.fecha, orgId)
    case 'M13': return generarBlobM13(ref.id, orgId)
    case 'M14': return generarBlobAuditoria(ref.id, orgId, 'm14')
    case 'M15': return generarBlobAuditoria(ref.id, orgId, 'm15')
    case 'M16': return generarBlobAuditoria(ref.id, orgId, 'm16')
    case 'M17': return generarBlobAuditoria(ref.id, orgId, 'm17')
    case 'M18': return generarBlobAuditoria(ref.id, orgId, 'm18')
    case 'M20': return generarBlobAccidenteLaboral(ref.id, orgId, codigoClave)
    case 'M21': return generarBlobMonitoreoEstaciones(ref.id, orgId, codigoClave)
    case 'M22': return generarBlobMuestrasLaboratorio(ref.id, orgId, codigoClave)
    case 'M23': return generarBlobVerificacionInsumos(ref.id, orgId, codigoClave)
    case 'M24': return generarBlobInventarioQuimicos(ref.id, orgId, codigoClave)
    case 'M25': return generarBlobResumenNoConformidades(ref.id, orgId)
    case 'M26': return generarBlobAccionCorrectiva(ref.id, orgId)
    case 'M27': return generarBlobPreparacionCloro(ref.id, orgId, codigoClave)
    case 'M28': return generarBlobLimpiezaBanosQuimicos(ref.id, orgId, codigoClave)
    case 'M29': return generarBlobLimpiezaAduana(ref.id, orgId, codigoClave)
    case 'M30': return generarBlobLimpiezaComedor(ref.id, orgId, codigoClave)
    case 'M31': return generarBlobLimpiezaOficinas(ref.id, orgId, codigoClave)
    case 'M32': return generarBlobLimpiezaPatiosAzoteas(ref.id, orgId, codigoClave)
    case 'M33': return generarBlobLimpiezaRecepcion(ref.id, orgId, codigoClave)
    case 'M34': return generarBlobLimpiezaPreenfrio(ref.id, orgId, codigoClave)
    case 'M35': return generarBlobLimpiezaAlmacenEmpaque(ref.id, orgId, codigoClave)
    case 'M36': return generarBlobMonitoreoGermicida(ref.id, orgId, codigoClave)
    case 'M37': return generarBlobLimpiezaCisterna(ref.id, orgId, codigoClave)
    case 'M38': return generarBlobManifiestoEmbarque(ref.id, orgId, codigoClave)
    case 'M39': return generarBlobRecepcionFruta(ref.id, orgId, codigoClave)
    case 'M40': return generarBlobEntradasSalidasPreFrio(ref.id, orgId, codigoClave)
    case 'M41': return generarBlobTemperaturaConservador(ref.id, orgId, codigoClave)
    case 'M42': return generarBlobMaterialEmpaque(ref.id, orgId, codigoClave)
    case 'M43': return generarBlobInspeccionAlmacenEmpaque(ref.id, orgId, codigoClave)
    case 'M44': return generarBlobOrdenMantenimiento(ref.id, orgId, codigoClave)
    case 'M45': return generarBlobMttoPreventivo(ref.id, orgId, codigoClave)
    case 'M46': return generarBlobRondinesVigilancia(ref.id, orgId, codigoClave)
  }
}

// ── Fusionador de PDFs ────────────────────────────────────────────────────────

export async function mergePDFBlobs(blobs: Blob[]): Promise<Blob> {
  const merged = await PDFDocument.create()
  for (const blob of blobs) {
    const bytes = await blob.arrayBuffer()
    const doc = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach((page) => merged.addPage(page))
  }
  const bytes = await merged.save()
  return new Blob([bytes], { type: 'application/pdf' })
}
