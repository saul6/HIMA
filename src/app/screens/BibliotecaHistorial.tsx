import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { ReactNode } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { ChevronLeft, ChevronDown, Search, X, Check, FileText, Package, Loader2, FilterX, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { Portal } from '@/app/components/Portal'
import { BottomSheet } from '@/app/components/BottomSheet'
import { SPRING_SUAVE } from '@/lib/motion'
import { ordenarAlfabetico } from '@/lib/ordenAlfabetico'
import { useContadorAnimado } from '@/hooks/useContadorAnimado'
import {
  type ModuloKey,
  type RegistroHistorial,
  generarBlobParaRef,
  mergePDFBlobs,
} from '@/lib/pdf/generarBlobHistorial'

// ── Metadatos de módulo ───────────────────────────────────────────────────────

const MODULO_META: Record<ModuloKey, { label: string; color: string }> = {
  M1:  { label: 'Aplicaciones',      color: '#1565C0' },
  M6:  { label: 'Botiquín',          color: '#2E7D32' },
  M7:  { label: 'Vidrio y Plástico', color: '#6A1B9A' },
  M8:  { label: 'Fertilización',     color: '#E65100' },
  M9:  { label: 'Perimetral',        color: '#00695C' },
  M10: { label: 'Cosecha',           color: '#AD1457' },
  M11: { label: 'Preoperacional',    color: '#283593' },
  M12: { label: 'Limpieza Baños',    color: '#4E342E' },
  M13: { label: 'Incidencias',       color: '#B71C1C' },
  M14: { label: 'Auditoría SAIA',    color: '#1A237E' },
  M15: { label: 'Auditoría Granja',  color: '#004D40' },
  M16: { label: 'Auditoría Cuadrilla', color: '#37474F' },
  M17: { label: 'BPM\'s',           color: '#4A148C' },
  M18: { label: 'HACCP',            color: '#006064' },
  M19: { label: 'Insp. Pre-operacional', color: '#004D61' },
  M20: { label: 'Accidentes Laborales',  color: '#7B1B1B' },
  M21: { label: 'Monitoreo de Plagas',   color: '#2E5900' },
  M22: { label: 'Muestras Laboratorio',  color: '#0D47A1' },
  M23: { label: 'Verificación Insumos', color: '#1B5E20' },
  M24: { label: 'Inv. Químicos',        color: '#37474F' },
  M25: { label: 'No-Conformidades',     color: '#7B1FA2' },
  M26: { label: 'Acciones Correctivas', color: '#BF360C' },
  M27: { label: 'Preparacion Cloro',   color: '#00796B' },
  M28: { label: 'Limpieza Banos/Quimicos', color: '#1B5E20' },
  M29: { label: 'Limpieza Aduana',         color: '#00695C' },
  M30: { label: 'Limpieza Comedor',        color: '#E65100' },
  M31: { label: 'Limpieza Oficinas',       color: '#0D47A1' },
  M32: { label: 'Limpieza Patios/Azoteas', color: '#2E7D32' },
  M33: { label: 'Limpieza Recepción',      color: '#006064' },
  M34: { label: 'Limpieza Pre-enfrío',     color: '#37474F' },
  M35: { label: 'Limpieza Almacén Empaque', color: '#4527A0' },
  M38: { label: 'Manifiesto Embarque',      color: '#1565C0' },
  M39: { label: 'Recepción Fruta',          color: '#006064' },
  M40: { label: 'Entradas/Salidas Pre-frío', color: '#004D61' },
  M41: { label: 'Temperaturas Conservador',  color: '#00695C' },
  M42: { label: 'Material de Empaque',       color: '#4A148C' },
  M43: { label: 'Insp. Almacén Empaque',     color: '#1B5E20' },
  M44: { label: 'Orden de Mantenimiento',    color: '#37474F' },
  M45: { label: 'Mtto. Preventivo',          color: '#455A64' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inicioRango(): string {
  const d = new Date()
  d.setDate(d.getDate() - 90)
  return d.toISOString().slice(0, 10)
}

function hoy(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// Ignora acentos/mayúsculas para el buscador de la ventana de módulos (los
// índices se conservan 1:1 frente al texto original: NFD descompone cada
// vocal/ñ acentuada en base + marca combinante, y aquí solo se quita la marca).
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g')
function normalizarBusqueda(s: string): string {
  return s.normalize('NFD').replace(DIACRITICOS, '').toLowerCase()
}

// Resalta la coincidencia dentro del texto original (con sus acentos intactos)
// aunque la búsqueda ignore acentos. Color --primary en vez de --secondary
// (menta): menta sobre bg-card no llega a 4.5:1 en ninguno de los dos temas.
function resaltarCoincidenciaModulo(texto: string, query: string): ReactNode {
  const q = normalizarBusqueda(query.trim())
  if (!q) return texto
  const idx = normalizarBusqueda(texto).indexOf(q)
  if (idx === -1) return texto
  return (
    <>
      {texto.slice(0, idx)}
      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{texto.slice(idx, idx + q.length)}</span>
      {texto.slice(idx + q.length)}
    </>
  )
}

// Número de resultados del botón Exportar — cuenta del valor anterior al
// nuevo con el mismo contador animado de Inicio (ver useContadorAnimado).
function ContadorRegistros({ value, reducedMotion }: { value: number; reducedMotion: boolean }) {
  const spanRef = useContadorAnimado(value, (n) => String(Math.round(n)), reducedMotion)
  return <span ref={spanRef} className="tabular-nums">{value}</span>
}

// ── Cargador de índice (8 consultas en paralelo) ──────────────────────────────

async function cargarTodo(orgId: string, desde: string, hasta: string): Promise<RegistroHistorial[]> {
  const desdeM = desde.slice(0, 7) + '-01'
  const hastaM = hasta.slice(0, 7) + '-01'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tbl = (name: string) => (supabase as any).from(name)

  const [r1, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16, r17, r18, r19, r20, r21, r22, r23, r24, r25, r26, r27, r28, r29, r30, r31, r32, r33, r34, r35, r38, r39, r40, r41, r42, r43, r44, r45] = await Promise.all([
    supabase.from('aplicaciones')
      .select('id, fecha_aplicacion, rancho_id, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha_aplicacion', desde).lte('fecha_aplicacion', hasta)
      .order('fecha_aplicacion', { ascending: false }).limit(500),
    supabase.from('m6_botiquin')
      .select('id, rancho_id, fecha_verificacion, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha_verificacion', desde).lte('fecha_verificacion', hasta)
      .order('fecha_verificacion', { ascending: false }).limit(500),
    supabase.from('m7_vidrio_plastico')
      .select('rancho_id, fecha, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(2000),
    supabase.from('m8_fertilizacion')
      .select('rancho_id, fecha, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(2000),
    supabase.from('m9_registro_mensual')
      .select('id, rancho_id, mes, ranchos(nombre)')
      .eq('org_id', orgId).gte('mes', desdeM).lte('mes', hastaM)
      .order('mes', { ascending: false }).limit(200),
    supabase.from('m10_cosecha_liberacion')
      .select('rancho_id, fecha, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(2000),
    supabase.from('m11_registro_mensual')
      .select('id, rancho_id, mes, ranchos(nombre)')
      .eq('org_id', orgId).gte('mes', desdeM).lte('mes', hastaM)
      .order('mes', { ascending: false }).limit(200),
    supabase.from('m12_limpieza_banos')
      .select('rancho_id, fecha, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(2000),
    supabase.from('m13_reportes')
      .select('id, rancho_id, fecha, ranchos(nombre), m13_incidencias(id)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(500),
    tbl('m14_auditorias')
      .select('id, rancho_id, fecha, porcentaje, estado, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(200),
    tbl('m15_auditorias')
      .select('id, rancho_id, fecha, porcentaje, estado, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(200),
    tbl('m16_auditorias')
      .select('id, rancho_id, fecha, porcentaje, estado, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(200),
    tbl('m17_auditorias')
      .select('id, rancho_id, fecha, porcentaje, estado, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(200),
    tbl('m18_auditorias')
      .select('id, rancho_id, fecha, porcentaje, estado, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(200),
    tbl('m19_registro_mensual')
      .select('id, rancho_id, mes, ranchos(nombre)')
      .eq('org_id', orgId).gte('mes', desdeM).lte('mes', hastaM)
      .order('mes', { ascending: false }).limit(200),
    tbl('m20_accidentes')
      .select('id, rancho_id, fecha, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(500),
    tbl('m21_revision')
      .select('id, rancho_id, fecha, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(500),
    tbl('m22_muestras')
      .select('id, rancho_id, fecha_muestreo, descripcion_muestra, laboratorio, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha_muestreo', desde).lte('fecha_muestreo', hasta)
      .order('fecha_muestreo', { ascending: false }).limit(500),
    tbl('m23_registro_mensual')
      .select('id, rancho_id, mes, ranchos(nombre)')
      .eq('org_id', orgId).gte('mes', desdeM).lte('mes', hastaM)
      .order('mes', { ascending: false }).limit(200),
    tbl('m24_movimientos')
      .select('quimico_id, fecha, m24_quimicos(nombre, unidad, rancho_id, ranchos(nombre))')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(2000),
    supabase.from('auditoria_visitas')
      .select('id, rancho_id, fecha, auditor_nombre, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(200),
    tbl('aud_acciones_correctivas')
      .select('id, created_at, aud_hallazgos!hallazgo_id(descripcion, criterion_code, detectado_en, source_module_code)')
      .eq('org_id', orgId)
      .eq('aud_hallazgos.origin_type', 'SELF_AUDIT')
      .gte('created_at', desde + 'T00:00:00').lte('created_at', hasta + 'T23:59:59')
      .order('created_at', { ascending: false }).limit(500),
    tbl('m27_preparaciones')
      .select('id, rancho_id, fecha, area, litros_agua, ml_cloro, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(500),
    tbl('m28_registro_mensual')
      .select('id, rancho_id, anio, mes, ranchos(nombre)')
      .eq('org_id', orgId)
      .gte('anio', parseInt(desdeM.slice(0, 4)))
      .lte('anio', parseInt(hastaM.slice(0, 4)))
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .limit(200),
    tbl('m29_registro_mensual')
      .select('id, rancho_id, anio, mes, ranchos(nombre)')
      .eq('org_id', orgId)
      .gte('anio', parseInt(desdeM.slice(0, 4)))
      .lte('anio', parseInt(hastaM.slice(0, 4)))
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .limit(200),
    tbl('m30_registro_mensual')
      .select('id, rancho_id, anio, mes, ranchos(nombre)')
      .eq('org_id', orgId)
      .gte('anio', parseInt(desdeM.slice(0, 4)))
      .lte('anio', parseInt(hastaM.slice(0, 4)))
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .limit(200),
    tbl('m31_registro_mensual')
      .select('id, rancho_id, anio, mes, ranchos(nombre)')
      .eq('org_id', orgId)
      .gte('anio', parseInt(desdeM.slice(0, 4)))
      .lte('anio', parseInt(hastaM.slice(0, 4)))
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .limit(200),
    tbl('m32_registro_mensual')
      .select('id, rancho_id, anio, mes, ranchos(nombre)')
      .eq('org_id', orgId)
      .gte('anio', parseInt(desdeM.slice(0, 4)))
      .lte('anio', parseInt(hastaM.slice(0, 4)))
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .limit(200),
    tbl('m33_registro_mensual')
      .select('id, rancho_id, anio, mes, ranchos(nombre)')
      .eq('org_id', orgId)
      .gte('anio', parseInt(desdeM.slice(0, 4)))
      .lte('anio', parseInt(hastaM.slice(0, 4)))
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .limit(200),
    tbl('m34_registro_mensual')
      .select('id, rancho_id, anio, mes, ranchos(nombre)')
      .eq('org_id', orgId)
      .gte('anio', parseInt(desdeM.slice(0, 4)))
      .lte('anio', parseInt(hastaM.slice(0, 4)))
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .limit(200),
    tbl('m35_registro_mensual')
      .select('id, rancho_id, anio, mes, ranchos(nombre)')
      .eq('org_id', orgId)
      .gte('anio', parseInt(desdeM.slice(0, 4)))
      .lte('anio', parseInt(hastaM.slice(0, 4)))
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .limit(200),
    tbl('m38_manifiestos')
      .select('id, rancho_id, fecha, folio, empresa, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(500),
    tbl('m39_recepciones')
      .select('id, rancho_id, fecha, empresa, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(500),
    tbl('m40_registros')
      .select('id, rancho_id, fecha, empresa, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(500),
    tbl('m41_registros')
      .select('id, rancho_id, fecha, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(500),
    tbl('m42_movimientos')
      .select('id, rancho_id, fecha, descripcion_material, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(500),
    tbl('m43_registro_mensual')
      .select('id, rancho_id, mes, ranchos(nombre)')
      .eq('org_id', orgId).gte('mes', desdeM).lte('mes', hastaM)
      .order('mes', { ascending: false }).limit(200),
    tbl('m44_ordenes')
      .select('id, rancho_id, fecha, folio, descripcion_solicitud, ranchos(nombre)')
      .eq('org_id', orgId).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(500),
    tbl('m45_registro_mensual')
      .select('id, rancho_id, anio, mes, ranchos(nombre)')
      .eq('org_id', orgId)
      .gte('anio', parseInt(desdeM.slice(0, 4)))
      .lte('anio', parseInt(hastaM.slice(0, 4)))
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .limit(200),
  ])

  const todos: RegistroHistorial[] = []

  // M1 — una fila = un documento
  for (const r of r1.data ?? []) {
    todos.push({
      key: `M1-${r.id}`,
      modulo: 'M1',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha_aplicacion,
      resumen: 'Aplicación de agroquímicos',
      pdfRef: { tipo: 'M1', id: r.id },
    })
  }

  // M6 — una fila = un documento
  for (const r of r6.data ?? []) {
    todos.push({
      key: `M6-${r.id}`,
      modulo: 'M6',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha_verificacion,
      resumen: 'Verificación de botiquín',
      pdfRef: { tipo: 'M6', id: r.id },
    })
  }

  // M7 — agrupar por rancho_id+fecha
  const m7map = new Map<string, { rancho_id: string; nombre: string; fecha: string; count: number }>()
  for (const r of r7.data ?? []) {
    const k = `${r.rancho_id}|${r.fecha}`
    const v = m7map.get(k)
    if (!v) m7map.set(k, { rancho_id: r.rancho_id, nombre: (r.ranchos as any)?.nombre ?? '—', fecha: r.fecha, count: 1 })
    else v.count++
  }
  for (const [, v] of m7map) {
    todos.push({
      key: `M7-${v.rancho_id}-${v.fecha}`,
      modulo: 'M7',
      rancho_id: v.rancho_id,
      rancho_nombre: v.nombre,
      fecha: v.fecha,
      resumen: `${v.count} material${v.count !== 1 ? 'es' : ''} inspeccionado${v.count !== 1 ? 's' : ''}`,
      pdfRef: { tipo: 'M7', ranchoId: v.rancho_id, fecha: v.fecha },
    })
  }

  // M8 — agrupar por rancho_id+fecha
  const m8map = new Map<string, { rancho_id: string; nombre: string; fecha: string; count: number }>()
  for (const r of r8.data ?? []) {
    const k = `${r.rancho_id}|${r.fecha}`
    const v = m8map.get(k)
    if (!v) m8map.set(k, { rancho_id: r.rancho_id, nombre: (r.ranchos as any)?.nombre ?? '—', fecha: r.fecha, count: 1 })
    else v.count++
  }
  for (const [, v] of m8map) {
    todos.push({
      key: `M8-${v.rancho_id}-${v.fecha}`,
      modulo: 'M8',
      rancho_id: v.rancho_id,
      rancho_nombre: v.nombre,
      fecha: v.fecha,
      resumen: `${v.count} producto${v.count !== 1 ? 's' : ''} fertilizante${v.count !== 1 ? 's' : ''}`,
      pdfRef: { tipo: 'M8', ranchoId: v.rancho_id, fecha: v.fecha },
    })
  }

  // M9 — una fila = un documento (mensual)
  for (const r of r9.data ?? []) {
    todos.push({
      key: `M9-${r.id}`,
      modulo: 'M9',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.mes,
      resumen: 'Inspección perimetral mensual',
      pdfRef: { tipo: 'M9', id: r.id },
    })
  }

  // M10 — agrupar por rancho_id+fecha
  const m10map = new Map<string, { rancho_id: string; nombre: string; fecha: string; count: number }>()
  for (const r of r10.data ?? []) {
    const k = `${r.rancho_id}|${r.fecha}`
    const v = m10map.get(k)
    if (!v) m10map.set(k, { rancho_id: r.rancho_id, nombre: (r.ranchos as any)?.nombre ?? '—', fecha: r.fecha, count: 1 })
    else v.count++
  }
  for (const [, v] of m10map) {
    todos.push({
      key: `M10-${v.rancho_id}-${v.fecha}`,
      modulo: 'M10',
      rancho_id: v.rancho_id,
      rancho_nombre: v.nombre,
      fecha: v.fecha,
      resumen: `${v.count} liberación${v.count !== 1 ? 'es' : ''} de cosecha`,
      pdfRef: { tipo: 'M10', ranchoId: v.rancho_id, fecha: v.fecha },
    })
  }

  // M11 — una fila = un documento (mensual)
  for (const r of r11.data ?? []) {
    todos.push({
      key: `M11-${r.id}`,
      modulo: 'M11',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.mes,
      resumen: 'Inspección preoperacional mensual',
      pdfRef: { tipo: 'M11', id: r.id },
    })
  }

  // M12 — agrupar por rancho_id+fecha
  const m12map = new Map<string, { rancho_id: string; nombre: string; fecha: string; count: number }>()
  for (const r of r12.data ?? []) {
    const k = `${r.rancho_id}|${r.fecha}`
    const v = m12map.get(k)
    if (!v) m12map.set(k, { rancho_id: r.rancho_id, nombre: (r.ranchos as any)?.nombre ?? '—', fecha: r.fecha, count: 1 })
    else v.count++
  }
  for (const [, v] of m12map) {
    todos.push({
      key: `M12-${v.rancho_id}-${v.fecha}`,
      modulo: 'M12',
      rancho_id: v.rancho_id,
      rancho_nombre: v.nombre,
      fecha: v.fecha,
      resumen: `${v.count} baño${v.count !== 1 ? 's' : ''} registrado${v.count !== 1 ? 's' : ''}`,
      pdfRef: { tipo: 'M12', ranchoId: v.rancho_id, fecha: v.fecha },
    })
  }

  // M13 — una fila = un reporte
  for (const r of r13.data ?? []) {
    const nInc = ((r as any).m13_incidencias ?? []).length
    todos.push({
      key: `M13-${r.id}`,
      modulo: 'M13',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha,
      resumen: `${nInc} incidencia${nInc !== 1 ? 's' : ''} registrada${nInc !== 1 ? 's' : ''}`,
      pdfRef: { tipo: 'M13', id: r.id },
    })
  }

  // M14 — una fila = una auditoría SAIA
  for (const r of (r14 as any)?.data ?? []) {
    const pct = r.porcentaje > 0 ? ` · ${r.porcentaje}%` : ''
    todos.push({
      key: `M14-${r.id}`,
      modulo: 'M14',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha,
      resumen: `Auditoría SAIA${pct}`,
      pdfRef: { tipo: 'M14', id: r.id },
    })
  }

  // M15 — una fila = una auditoría Granja
  for (const r of (r15 as any)?.data ?? []) {
    const pct = r.porcentaje > 0 ? ` · ${r.porcentaje}%` : ''
    todos.push({
      key: `M15-${r.id}`,
      modulo: 'M15',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha,
      resumen: `Auditoría Granja${pct}`,
      pdfRef: { tipo: 'M15', id: r.id },
    })
  }

  // M16 — una fila = una auditoría Cuadrilla
  for (const r of (r16 as any)?.data ?? []) {
    const pct = r.porcentaje > 0 ? ` · ${r.porcentaje}%` : ''
    todos.push({
      key: `M16-${r.id}`,
      modulo: 'M16',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha,
      resumen: `Auditoría Cuadrilla${pct}`,
      pdfRef: { tipo: 'M16', id: r.id },
    })
  }

  // M17 — una fila = una auditoría BPM
  for (const r of (r17 as any)?.data ?? []) {
    const pct = r.porcentaje > 0 ? ` · ${r.porcentaje}%` : ''
    todos.push({
      key: `M17-${r.id}`,
      modulo: 'M17',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha,
      resumen: `Auditoría BPM${pct}`,
      pdfRef: { tipo: 'M17', id: r.id },
    })
  }

  // M18 — una fila = una auditoría HACCP
  for (const r of (r18 as any)?.data ?? []) {
    const pct = r.porcentaje > 0 ? ` · ${r.porcentaje}%` : ''
    todos.push({
      key: `M18-${r.id}`,
      modulo: 'M18',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha,
      resumen: `Auditoría HACCP${pct}`,
      pdfRef: { tipo: 'M18', id: r.id },
    })
  }

  // M19 — una fila = un registro mensual (Cuarto Frío)
  for (const r of (r19 as any)?.data ?? []) {
    todos.push({
      key: `M19-${r.id}`,
      modulo: 'M19',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.mes,
      resumen: 'Inspección pre-operacional mensual',
      pdfRef: { tipo: 'M19', id: r.id },
    })
  }

  // M20 — una fila = un accidente laboral (Cuarto Frío)
  for (const r of (r20 as any)?.data ?? []) {
    todos.push({
      key: `M20-${r.id}`,
      modulo: 'M20',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha,
      resumen: 'Registro de accidente laboral',
      pdfRef: { tipo: 'M20', id: r.id },
    })
  }

  // M21 — una fila = una revisión de estaciones de monitoreo (Cuarto Frío)
  for (const r of (r21 as any)?.data ?? []) {
    todos.push({
      key: `M21-${r.id}`,
      modulo: 'M21',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha,
      resumen: 'Revisión de estaciones de monitoreo de plagas',
      pdfRef: { tipo: 'M21', id: r.id },
    })
  }

  // M22 — una fila = un registro de muestras enviadas al laboratorio (Cuarto Frío)
  for (const r of (r22 as any)?.data ?? []) {
    todos.push({
      key: `M22-${r.id}`,
      modulo: 'M22',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha_muestreo,
      resumen: `${r.descripcion_muestra} · ${r.laboratorio}`,
      pdfRef: { tipo: 'M22', id: r.id },
    })
  }

  // M23 — una fila = un registro mensual de verificación de insumos (Cuarto Frío)
  for (const r of (r23 as any)?.data ?? []) {
    todos.push({
      key: `M23-${r.id}`,
      modulo: 'M23',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.mes,
      resumen: 'Verificación de insumos mensual',
      pdfRef: { tipo: 'M23', id: r.id },
    })
  }

  // M24 — agrupar por quimico_id (kardex de químicos, Cuarto Frío)
  const m24map = new Map<string, { quimico_id: string; nombre: string; rancho_id: string; rancho_nombre: string; count: number; fecha: string }>()
  for (const r of (r24 as any)?.data ?? []) {
    const q = (r.m24_quimicos as any)
    if (!m24map.has(r.quimico_id)) {
      m24map.set(r.quimico_id, {
        quimico_id: r.quimico_id,
        nombre: q?.nombre ?? '—',
        rancho_id: q?.rancho_id ?? '',
        rancho_nombre: (q?.ranchos as any)?.nombre ?? '—',
        count: 1,
        fecha: r.fecha,
      })
    } else {
      m24map.get(r.quimico_id)!.count++
    }
  }
  for (const [, v] of m24map) {
    todos.push({
      key: `M24-${v.quimico_id}`,
      modulo: 'M24',
      rancho_id: v.rancho_id,
      rancho_nombre: v.rancho_nombre,
      fecha: v.fecha,
      resumen: `${v.nombre} · ${v.count} movimiento${v.count !== 1 ? 's' : ''}`,
      pdfRef: { tipo: 'M24', id: v.quimico_id },
    })
  }

  // M25 — una fila = una visita de auditoría (Resumen de No-Conformidades)
  for (const r of (r25 as any)?.data ?? []) {
    todos.push({
      key: `M25-${r.id}`,
      modulo: 'M25',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha,
      resumen: `Resumen de No-Conformidades · ${r.auditor_nombre ?? ''}`.trimEnd().replace(/ ·\s*$/, ''),
      pdfRef: { tipo: 'M25', id: r.id },
    })
  }

  // M26 — una fila = una CAPA canónica (aud_acciones_correctivas + aud_hallazgos)
  for (const r of (r26 as any)?.data ?? []) {
    const h = (r.aud_hallazgos as any) ?? {}
    todos.push({
      key: `M26-${r.id}`,
      modulo: 'M26',
      rancho_id: null,
      rancho_nombre: '—',
      fecha: h.detectado_en ?? r.created_at?.split('T')[0] ?? '',
      resumen: `${h.criterion_code ?? '—'}: ${(h.descripcion as string | null)?.slice(0, 80) ?? '—'}`,
      pdfRef: { tipo: 'M26', id: r.id },
    })
  }

  // M27 — una fila = una preparacion de cloro
  for (const r of (r27 as any)?.data ?? []) {
    todos.push({
      key: `M27-${r.id}`,
      modulo: 'M27',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha,
      resumen: `Preparacion cloro · ${r.area} · ${r.litros_agua} L => ${r.ml_cloro} mL`,
      pdfRef: { tipo: 'M27', id: r.id },
    })
  }

  // M28 — una fila = un registro mensual de limpieza de baños y almacen de químicos
  for (const r of (r28 as any)?.data ?? []) {
    const mesLabel = new Date(r.anio, r.mes - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    todos.push({
      key: `M28-${r.id}`,
      modulo: 'M28',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: `${r.anio}-${String(r.mes).padStart(2, '0')}-01`,
      resumen: `Limpieza de baños y almacen - ${mesLabel}`,
      pdfRef: { tipo: 'M28', id: r.id },
    })
  }

  // M29 — una fila = un registro mensual de limpieza de la aduana
  for (const r of (r29 as any)?.data ?? []) {
    const mesLabel = new Date(r.anio, r.mes - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    todos.push({
      key: `M29-${r.id}`,
      modulo: 'M29',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: `${r.anio}-${String(r.mes).padStart(2, '0')}-01`,
      resumen: `Limpieza de la aduana - ${mesLabel}`,
      pdfRef: { tipo: 'M29', id: r.id },
    })
  }

  // M30 — una fila = un registro mensual de limpieza del comedor
  for (const r of (r30 as any)?.data ?? []) {
    const mesLabel = new Date(r.anio, r.mes - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    todos.push({
      key: `M30-${r.id}`,
      modulo: 'M30',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: `${r.anio}-${String(r.mes).padStart(2, '0')}-01`,
      resumen: `Limpieza del comedor - ${mesLabel}`,
      pdfRef: { tipo: 'M30', id: r.id },
    })
  }

  // M31 — una fila = un registro mensual de limpieza de las oficinas
  for (const r of (r31 as any)?.data ?? []) {
    const mesLabel = new Date(r.anio, r.mes - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    todos.push({
      key: `M31-${r.id}`,
      modulo: 'M31',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: `${r.anio}-${String(r.mes).padStart(2, '0')}-01`,
      resumen: `Limpieza de las oficinas - ${mesLabel}`,
      pdfRef: { tipo: 'M31', id: r.id },
    })
  }

  // M32 — una fila = un registro mensual de limpieza de patios exteriores y azoteas
  for (const r of (r32 as any)?.data ?? []) {
    const mesLabel = new Date(r.anio, r.mes - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    todos.push({
      key: `M32-${r.id}`,
      modulo: 'M32',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: `${r.anio}-${String(r.mes).padStart(2, '0')}-01`,
      resumen: `Limpieza de patios exteriores y azoteas - ${mesLabel}`,
      pdfRef: { tipo: 'M32', id: r.id },
    })
  }

  // M33 — una fila = un registro mensual de limpieza del área de recepción
  for (const r of (r33 as any)?.data ?? []) {
    const mesLabel = new Date(r.anio, r.mes - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    todos.push({
      key: `M33-${r.id}`,
      modulo: 'M33',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: `${r.anio}-${String(r.mes).padStart(2, '0')}-01`,
      resumen: `Limpieza del área de recepción - ${mesLabel}`,
      pdfRef: { tipo: 'M33', id: r.id },
    })
  }

  // M34 — una fila = un registro mensual de limpieza de cuartos de pre-enfrío y conservador
  for (const r of (r34 as any)?.data ?? []) {
    const mesLabel = new Date(r.anio, r.mes - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    todos.push({
      key: `M34-${r.id}`,
      modulo: 'M34',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: `${r.anio}-${String(r.mes).padStart(2, '0')}-01`,
      resumen: `Limpieza de cuartos de pre-enfrío y conservador - ${mesLabel}`,
      pdfRef: { tipo: 'M34', id: r.id },
    })
  }

  // M35 — una fila = un registro mensual de limpieza del almacén de material de empaque
  for (const r of (r35 as any)?.data ?? []) {
    const mesLabel = new Date(r.anio, r.mes - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    todos.push({
      key: `M35-${r.id}`,
      modulo: 'M35',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: `${r.anio}-${String(r.mes).padStart(2, '0')}-01`,
      resumen: `Limpieza del almacén de material de empaque - ${mesLabel}`,
      pdfRef: { tipo: 'M35', id: r.id },
    })
  }

  // M38 — una fila = un manifiesto de embarque
  for (const r of (r38 as any)?.data ?? []) {
    todos.push({
      key: `M38-${r.id}`,
      modulo: 'M38',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha,
      resumen: `Manifiesto de Embarque${r.folio ? ' #' + r.folio : ''}${r.empresa ? ' · ' + r.empresa : ''}`,
      pdfRef: { tipo: 'M38', id: r.id },
    })
  }

  // M39 — una fila = una recepción diaria de fruta
  for (const r of (r39 as any)?.data ?? []) {
    todos.push({
      key: `M39-${r.id}`,
      modulo: 'M39',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha,
      resumen: `Recepción Diaria de Fruta${r.empresa ? ' · ' + r.empresa : ''}`,
      pdfRef: { tipo: 'M39', id: r.id },
    })
  }

  // M40 — una fila = un registro de entradas y salidas en pre-frío
  for (const r of (r40 as any)?.data ?? []) {
    todos.push({
      key: `M40-${r.id}`,
      modulo: 'M40',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha,
      resumen: `Entradas y Salidas en Pre-enfriamiento${r.empresa ? ' · ' + r.empresa : ''}`,
      pdfRef: { tipo: 'M40', id: r.id },
    })
  }

  // M41 — un registro por día por instalación
  for (const r of (r41 as any)?.data ?? []) {
    todos.push({
      key: `M41-${r.id}`,
      modulo: 'M41',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha,
      resumen: 'Temperaturas del Conservador',
      pdfRef: { tipo: 'M41', id: r.id },
    })
  }

  // M42 — una fila = un movimiento de material de empaque
  for (const r of (r42 as any)?.data ?? []) {
    todos.push({
      key: `M42-${r.id}`,
      modulo: 'M42',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha,
      resumen: `Material de Empaque${r.descripcion_material ? ' · ' + r.descripcion_material : ''}`,
      pdfRef: { tipo: 'M42', id: r.id },
    })
  }

  // M44 — una fila = una orden de mantenimiento
  for (const r of (r44 as any)?.data ?? []) {
    todos.push({
      key: `M44-${r.id}`,
      modulo: 'M44',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.fecha,
      resumen: `Orden de Mantenimiento${r.folio ? ' #' + r.folio : ''}${r.descripcion_solicitud ? ' · ' + r.descripcion_solicitud : ''}`,
      pdfRef: { tipo: 'M44', id: r.id },
    })
  }

  // M45 — una fila = un registro mensual de mantenimiento preventivo
  for (const r of (r45 as any)?.data ?? []) {
    const desdeV = parseInt(desdeM.slice(0, 4)) * 12 + parseInt(desdeM.slice(5, 7))
    const hastaV = parseInt(hastaM.slice(0, 4)) * 12 + parseInt(hastaM.slice(5, 7))
    const v = (r.anio as number) * 12 + (r.mes as number)
    if (v < desdeV || v > hastaV) continue
    const ml = new Date(r.anio, r.mes - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    todos.push({
      key: `M45-${r.id}`,
      modulo: 'M45',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: `${r.anio}-${String(r.mes).padStart(2, '0')}-01`,
      resumen: `Mtto. Preventivo - ${ml}`,
      pdfRef: { tipo: 'M45', id: r.id },
    })
  }

  // M43 — una fila = un registro mensual de inspección de almacén de material de empaque
  for (const r of (r43 as any)?.data ?? []) {
    todos.push({
      key: `M43-${r.id}`,
      modulo: 'M43',
      rancho_id: r.rancho_id,
      rancho_nombre: (r.ranchos as any)?.nombre ?? '—',
      fecha: r.mes,
      resumen: 'Inspección de almacén de material de empaque mensual',
      pdfRef: { tipo: 'M43', id: r.id },
    })
  }

  todos.sort((a, b) => b.fecha.localeCompare(a.fecha))
  return todos
}

// ── Componente principal ──────────────────────────────────────────────────────

export function BibliotecaHistorial() {
  const { profile, codigoClave } = useAuthContext()
  const orgId = profile?.org_id ?? ''
  const { modulos: misModulos, terminosSitio } = useModulosContext()

  // Módulos accesibles para este usuario (excluye historial, ordenados por orden)
  const modulosDisponibles = useMemo<ModuloKey[]>(() => {
    return misModulos
      .filter(m => m.clave !== 'historial' && m.codigo in MODULO_META)
      .sort((a, b) => a.orden - b.orden)
      .map(m => m.codigo as ModuloKey)
  }, [misModulos])

  // Rango de búsqueda — se confirma solo ~400ms después del último cambio en
  // Desde/Hasta (debounce, ver efecto más abajo); no hay botón Buscar
  const [inputDesde, setInputDesde] = useState(inicioRango)
  const [inputHasta, setInputHasta] = useState(hoy)
  const [buscarDesde, setBuscarDesde] = useState(inicioRango)
  const [buscarHasta, setBuscarHasta] = useState(hoy)

  // Filtros client-side: arranca vacío — el usuario elige módulos para ver
  // resultados (la consulta solo depende del rango de fechas, ver cargar())
  const [filtroModulos, setFiltroModulos] = useState<Set<ModuloKey>>(() => new Set())

  const [filtroRancho, setFiltroRancho] = useState<string>('todos')

  // Ventana de módulos — estados de interfaz locales, no afectan la selección
  const [modulosSheetOpen, setModulosSheetOpen] = useState(false)
  const [busquedaModulos, setBusquedaModulos] = useState('')
  const buscadorModulosRef = useRef<HTMLInputElement>(null)

  function cerrarModulosSheet() {
    setModulosSheetOpen(false)
    setBusquedaModulos('')
  }

  function seleccionarTodosModulos() {
    setFiltroModulos(new Set(modulosDisponibles))
  }

  function limpiarModulos() {
    setFiltroModulos(new Set())
  }

  useEffect(() => {
    if (!modulosSheetOpen) return
    if (typeof window === 'undefined' || !window.matchMedia('(min-width: 768px)').matches) return
    const id = requestAnimationFrame(() => buscadorModulosRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [modulosSheetOpen])

  // Nombres completos por módulo (de misModulos, no de MODULO_META)
  const mapaNombres = useMemo(() => new Map(misModulos.map(m => [m.codigo, m.nombre])), [misModulos])
  const nombreModulo = useCallback(
    (m: ModuloKey) => mapaNombres.get(m) ?? MODULO_META[m].label,
    [mapaNombres],
  )

  const todosSeleccionados = filtroModulos.size === modulosDisponibles.length

  const modulosOrdenados = useMemo(
    () => ordenarAlfabetico(modulosDisponibles, nombreModulo),
    [modulosDisponibles, nombreModulo],
  )

  const modulosVisiblesSheet = useMemo(() => {
    const q = normalizarBusqueda(busquedaModulos.trim())
    if (!q) return modulosOrdenados
    return modulosOrdenados.filter((m) => {
      const nombre = normalizarBusqueda(nombreModulo(m))
      const codigo = normalizarBusqueda(m)
      return nombre.includes(q) || codigo.includes(q)
    })
  }, [modulosOrdenados, busquedaModulos, nombreModulo])

  const modulosSeleccionadosOrdenados = useMemo(
    () => modulosOrdenados.filter((m) => filtroModulos.has(m)),
    [modulosOrdenados, filtroModulos],
  )

  // Datos
  const [registros, setRegistros] = useState<RegistroHistorial[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reducedMotion = useReducedMotion()
  // true solo durante el render provocado por una búsqueda recién terminada
  // (ver cargar()) — decide si las filas entran escalonadas o solo con fade.
  const freshSearchRef = useRef(false)
  useEffect(() => {
    freshSearchRef.current = false
  })

  // PDF state
  const [descargandoPDF, setDescargandoPDF] = useState<string | null>(null)
  const [generandoPaquete, setGenerandoPaquete] = useState(false)
  const [progresoActual, setProgresoActual] = useState(0)
  const [progresoTotal, setProgresoTotal] = useState(0)

  // Fechas válidas: ambas presentes y Desde <= Hasta (comparación lexicográfica
  // válida porque los inputs type="date" siempre entregan 'YYYY-MM-DD')
  const fechasValidas = !!inputDesde && !!inputHasta && inputDesde <= inputHasta

  // Descarta respuestas de consultas viejas si una más nueva ya se disparó
  const requestIdRef = useRef(0)
  const cargar = useCallback(async () => {
    if (!orgId) return
    const id = ++requestIdRef.current
    setLoading(true)
    setError(null)
    try {
      const data = await cargarTodo(orgId, buscarDesde, buscarHasta)
      if (requestIdRef.current !== id) return
      freshSearchRef.current = true
      setRegistros(data)
    } catch (e: unknown) {
      if (requestIdRef.current !== id) return
      console.error(e instanceof Error ? e.message : e)
      setError('No se pudieron cargar los registros')
    } finally {
      if (requestIdRef.current === id) setLoading(false)
    }
  }, [orgId, buscarDesde, buscarHasta])

  // Confirma el rango ~400ms después del último cambio en Desde/Hasta
  useEffect(() => {
    if (!fechasValidas) return
    const id = setTimeout(() => {
      setBuscarDesde(inputDesde)
      setBuscarHasta(inputHasta)
    }, 400)
    return () => clearTimeout(id)
  }, [inputDesde, inputHasta, fechasValidas])

  // Consulta automática: solo con al menos 1 módulo elegido, y solo si el
  // rango confirmado es distinto al de la última consulta exitosa
  const ultimoRangoRef = useRef<string | null>(null)
  useEffect(() => {
    if (filtroModulos.size === 0) return
    if (!buscarDesde || !buscarHasta || buscarDesde > buscarHasta) return
    const rango = `${buscarDesde}|${buscarHasta}`
    if (ultimoRangoRef.current === rango) return
    ultimoRangoRef.current = rango
    cargar()
  }, [buscarDesde, buscarHasta, filtroModulos.size, cargar])

  // Sitios para el filtro: los disponibles para el usuario (useRanchos, ya
  // respeta RLS: admin/asesor ven todos los de la org, operario solo los
  // asignados), unidos con los presentes en los resultados cargados (por si
  // alguno no viniera del hook) — sin duplicados por id
  const { ranchos: ranchosDisponibles } = useRanchos()
  const ranchos = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of ranchosDisponibles) {
      map.set(r.id, r.nombre)
    }
    for (const r of registros) {
      if (r.rancho_id && !map.has(r.rancho_id)) {
        map.set(r.rancho_id, r.rancho_nombre)
      }
    }
    return ordenarAlfabetico(Array.from(map.entries()), ([, nombre]) => nombre)
  }, [ranchosDisponibles, registros])

  // Filtrado client-side
  const filtrados = useMemo(() => {
    return registros
      .filter((r) => filtroModulos.has(r.modulo))
      .filter((r) => filtroRancho === 'todos' || r.rancho_id === filtroRancho)
  }, [registros, filtroModulos, filtroRancho])

  function toggleModulo(m: ModuloKey) {
    setFiltroModulos((prev) => {
      const next = new Set(prev)
      if (next.has(m)) {
        next.delete(m)
      } else {
        next.add(m)
      }
      return next
    })
  }

  async function handleDescargarPDF(reg: RegistroHistorial) {
    setDescargandoPDF(reg.key)
    try {
      const blob = await generarBlobParaRef(reg.pdfRef, orgId, codigoClave)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reg.modulo.toLowerCase()}-${reg.fecha.replaceAll('-', '')}-${slugify(reg.rancho_nombre)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('No se pudo generar el PDF')
    } finally {
      setDescargandoPDF(null)
    }
  }

  async function handleExportarPaquete() {
    if (filtrados.length === 0) {
      toast.warning('No hay registros para exportar')
      return
    }
    setGenerandoPaquete(true)
    setProgresoActual(0)
    setProgresoTotal(filtrados.length)
    try {
      const blobs: Blob[] = []
      for (let i = 0; i < filtrados.length; i++) {
        setProgresoActual(i + 1)
        const blob = await generarBlobParaRef(filtrados[i].pdfRef, orgId, codigoClave)
        blobs.push(blob)
      }
      const megaBlob = await mergePDFBlobs(blobs)
      const url = URL.createObjectURL(megaBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `historial-agrocampo-${buscarDesde.replaceAll('-', '')}-${buscarHasta.replaceAll('-', '')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Paquete generado: ${filtrados.length} registros`)
    } catch {
      toast.error('Error al generar el paquete PDF')
    } finally {
      setGenerandoPaquete(false)
    }
  }

  return (
    <div className="min-h-full pb-safe-nav">

      {/* Header — mismo patrón que Inventario: arriba a la izquierda, a todo lo ancho, con línea inferior */}
      <header className="bg-card border-b border-border px-4 py-4">
        <h1 className="text-foreground" style={{ fontWeight: 600 }}>
          Historial de Registros
        </h1>
      </header>

      <div className="p-4 space-y-4">

        {/* Barra de filtros */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:items-end">
            <div className="min-w-0">
              <label htmlFor="historial-desde" className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                Desde
              </label>
              <input
                id="historial-desde"
                type="date"
                value={inputDesde}
                onChange={(e) => setInputDesde(e.target.value)}
                className="w-full min-w-0 mt-1 px-3 py-2 rounded-lg text-sm border appearance-none [&::-webkit-date-and-time-value]:text-left"
                style={{ background: 'var(--input-background)', borderColor: 'var(--border)' }}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="historial-hasta" className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                Hasta
              </label>
              <input
                id="historial-hasta"
                type="date"
                value={inputHasta}
                onChange={(e) => setInputHasta(e.target.value)}
                className="w-full min-w-0 mt-1 px-3 py-2 rounded-lg text-sm border appearance-none [&::-webkit-date-and-time-value]:text-left"
                style={{ background: 'var(--input-background)', borderColor: 'var(--border)' }}
              />
            </div>

            <div className="col-span-2 md:col-span-1 min-w-0">
              <label htmlFor="historial-sitio" className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                {terminosSitio.singular}
              </label>
              <select
                id="historial-sitio"
                value={filtroRancho}
                onChange={(e) => setFiltroRancho(e.target.value)}
                className="w-full min-w-0 mt-1 px-3 py-2 rounded-lg text-sm border"
                style={{ background: 'var(--input-background)', borderColor: 'var(--border)' }}
              >
                <option value="todos">{terminosSitio.plural}</option>
                {ranchos.map(([id, nombre]) => (
                  <option key={id} value={id}>{nombre}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2 md:col-span-1 min-w-0">
              <span id="historial-modulos-label" className="text-[11px] block" style={{ color: 'var(--muted-foreground)' }}>
                Módulos
              </span>
              <button
                type="button"
                aria-labelledby="historial-modulos-label"
                aria-haspopup="dialog"
                onClick={() => setModulosSheetOpen(true)}
                className="w-full min-w-0 mt-1 px-3 py-2 rounded-lg text-sm border"
                style={{
                  background: 'var(--input-background)',
                  borderColor: todosSeleccionados ? 'var(--border)' : 'var(--ring)',
                }}
              >
                <span className="flex items-center justify-between gap-2 w-full">
                  <span className="truncate">
                    {filtroModulos.size === 0
                      ? 'Selecciona módulos'
                      : todosSeleccionados
                        ? 'Todos los módulos'
                        : `${filtroModulos.size} de ${modulosDisponibles.length} módulos`}
                  </span>
                  <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                </span>
              </button>
            </div>
          </div>

          {!fechasValidas ? (
            <p role="status" aria-live="polite" className="text-[11px] mt-2" style={{ color: 'var(--destructive)' }}>
              La fecha inicial debe ser anterior o igual a la final
            </p>
          ) : loading ? (
            <p role="status" aria-live="polite" className="text-[11px] mt-2" style={{ color: 'var(--muted-foreground)' }}>
              Buscando…
            </p>
          ) : null}
        </div>

        {/* Resumen de módulos filtrados — solo escritorio (ver móvil abajo) */}
        {!todosSeleccionados && (
          <div className="hidden md:flex flex-wrap items-center gap-2">
            <AnimatePresence initial={false}>
              {modulosSeleccionadosOrdenados.map((m) => (
                <motion.span
                  key={m}
                  layout
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reducedMotion ? undefined : { opacity: 0, scale: 0.85 }}
                  transition={reducedMotion ? { duration: 0 } : SPRING_SUAVE}
                  className="inline-flex items-center gap-1.5 pl-3 pr-2 h-7 rounded-full text-xs"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)', fontWeight: 600 }}
                >
                  {nombreModulo(m)}
                  <button
                    type="button"
                    onClick={() => toggleModulo(m)}
                    aria-label={`Quitar ${nombreModulo(m)}`}
                    className="rounded-full hover:opacity-70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
            {filtroModulos.size > 0 && (
              <button
                type="button"
                onClick={limpiarModulos}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-4"
                style={{ transitionDuration: 'var(--motion-fast)' }}
              >
                <FilterX className="w-3.5 h-3.5" />
                Limpiar
              </button>
            )}
          </div>
        )}

        {/* Exportar paquete PDF — fila propia, a todo lo ancho */}
        {filtrados.length > 0 && (
          <button
            onClick={handleExportarPaquete}
            disabled={generandoPaquete || !!descargandoPDF}
            className="w-full min-h-10 py-2 px-3 flex items-center justify-center gap-2 rounded-xl border border-primary text-primary text-sm hover:bg-primary/5 active:scale-[0.98] transition-[background-color,transform] duration-150 ease-out disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            style={{ fontWeight: 600 }}
          >
            {generandoPaquete ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : <Package className="w-4 h-4 flex-shrink-0" />}
            <span className="text-center leading-snug">
              Exportar paquete PDF (<ContadorRegistros value={filtrados.length} reducedMotion={!!reducedMotion} /> registros)
            </span>
          </button>
        )}

        {/* Lista de registros — crossfade rápido entre estados (cargando,
            vacíos, lista) al buscar; ver AnimatePresence interno para el
            stagger de las filas. */}
        <AnimatePresence initial={false}>
          {loading ? (
            <motion.div
              key="cargando"
              exit={reducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border"
            >
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-10 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
                      <div className="h-3 w-24 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                    </div>
                    <div className="h-3.5 rounded w-1/2" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="h-2.5 rounded w-1/3" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="h-2.5 rounded w-2/3" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg" style={{ backgroundColor: 'var(--muted)' }} />
                </div>
              ))}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              exit={reducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="py-8 text-center text-sm"
              style={{ color: 'var(--destructive)' }}
            >
              {error}
            </motion.div>
          ) : filtroModulos.size === 0 ? (
            <motion.div
              key="sin-modulos"
              exit={reducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="py-14 text-center space-y-2"
              style={reducedMotion ? undefined : { animation: 'slideUpFade var(--motion-base) var(--ease-out) both' }}
            >
              <Filter className="w-10 h-10 mx-auto" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Elige los módulos para ver los registros
              </p>
            </motion.div>
          ) : filtrados.length === 0 ? (
            <motion.div
              key="sin-resultados"
              exit={reducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="py-14 text-center space-y-2"
              style={reducedMotion ? undefined : { animation: 'slideUpFade var(--motion-base) var(--ease-out) both' }}
            >
              <FilterX className="w-10 h-10 mx-auto" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Sin registros en este periodo
              </p>
              <p className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                Prueba un rango de fechas más amplio
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="lista"
              exit={reducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border"
            >
              <AnimatePresence initial={false}>
                {filtrados.map((reg, index) => {
                  const escalonado = !reducedMotion && freshSearchRef.current
                  return (
                    <motion.div
                      key={reg.key}
                      layout
                      initial={
                        reducedMotion ? false : escalonado ? { opacity: 0, y: 8 } : { opacity: 0 }
                      }
                      animate={escalonado ? { opacity: 1, y: 0 } : { opacity: 1 }}
                      exit={reducedMotion ? undefined : { opacity: 0 }}
                      transition={
                        reducedMotion
                          ? { duration: 0 }
                          : escalonado
                            ? { duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 7) * 0.03 }
                            : { duration: 0.15, ease: [0.22, 1, 0.36, 1] }
                      }
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
                      style={{ transitionDuration: 'var(--motion-fast)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] text-white"
                            style={{ backgroundColor: MODULO_META[reg.modulo].color, fontWeight: 700 }}
                          >
                            {reg.modulo}
                          </span>
                          <span className="text-[11px] truncate" style={{ color: 'var(--muted-foreground)' }}>
                            {MODULO_META[reg.modulo].label}
                          </span>
                        </div>
                        <p
                          className="text-[13px] truncate"
                          style={{ fontWeight: 600, overflowWrap: 'anywhere' }}
                          title={reg.rancho_nombre}
                        >
                          {reg.rancho_nombre}
                        </p>
                        <p className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                          {formatFecha(reg.fecha)}
                        </p>
                        <p
                          className="text-[11px] mt-0.5 line-clamp-2"
                          style={{ color: 'var(--muted-foreground)', overflowWrap: 'anywhere' }}
                          title={reg.resumen}
                        >
                          {reg.resumen}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDescargarPDF(reg)}
                        disabled={descargandoPDF === reg.key || generandoPaquete}
                        className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border disabled:opacity-40"
                        style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                        title="Descargar PDF"
                      >
                        {descargandoPDF === reg.key
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <FileText className="w-4 h-4" />
                        }
                      </button>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Overlay de progreso */}
      {generandoPaquete && (
        <Portal>
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="bg-card rounded-2xl p-6 mx-4 w-full max-w-xs text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: 'var(--primary)' }} />
            <div>
              <p className="text-[15px]" style={{ fontWeight: 600 }}>Generando paquete PDF</p>
              <p className="text-[13px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
                {progresoActual} de {progresoTotal} registros
              </p>
            </div>
            <div className="w-full h-2 rounded-full" style={{ background: 'var(--muted)' }}>
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  background: 'var(--primary)',
                  width: progresoTotal > 0 ? `${(progresoActual / progresoTotal) * 100}%` : '0%',
                }}
              />
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Ventana de módulos */}
      <BottomSheet open={modulosSheetOpen} onClose={cerrarModulosSheet} height="85%">

        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Módulos</h2>
            <motion.span
              key={filtroModulos.size}
              initial={reducedMotion ? false : { scale: 0.7 }}
              animate={{ scale: 1 }}
              transition={reducedMotion ? { duration: 0 } : SPRING_SUAVE}
              className="px-2 py-0.5 rounded-full text-[11px]"
              style={{ backgroundColor: 'rgba(42, 173, 149, 0.16)', color: 'var(--primary)', fontWeight: 700 }}
            >
              {filtroModulos.size}
            </motion.span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={seleccionarTodosModulos}
              className="text-xs"
              style={{ color: 'var(--primary)', fontWeight: 600, opacity: todosSeleccionados ? 0.4 : 1 }}
            >
              Seleccionar todos
            </button>
            <button
              type="button"
              onClick={limpiarModulos}
              className="text-xs"
              style={{ color: 'var(--primary)', fontWeight: 600, opacity: filtroModulos.size === 0 ? 0.4 : 1 }}
            >
              Limpiar
            </button>
            <button type="button" onClick={cerrarModulosSheet} className="p-1" aria-label="Cerrar">
              <X className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
            </button>
          </div>
        </div>

        <div className="px-4 py-3 flex-shrink-0">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--muted-foreground)' }}
            />
            <input
              ref={buscadorModulosRef}
              type="text"
              value={busquedaModulos}
              onChange={(e) => setBusquedaModulos(e.target.value)}
              placeholder="Buscar módulo por nombre o código"
              aria-label="Buscar módulo por nombre o código"
              className="w-full h-10 pl-9 pr-3 rounded-lg text-sm border outline-none"
              style={{ background: 'var(--input-background)', borderColor: 'var(--ring)', color: 'var(--foreground)' }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {modulosVisiblesSheet.length === 0 ? (
            <div
              key={busquedaModulos}
              className="py-10 text-center space-y-2"
              style={reducedMotion ? undefined : { animation: 'slideUpFade var(--motion-base) var(--ease-out) both' }}
            >
              <Search className="w-8 h-8 mx-auto" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Ningún módulo coincide con &quot;{busquedaModulos}&quot;
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {modulosVisiblesSheet.map((m) => {
                const active = filtroModulos.has(m)
                return (
                  <motion.div
                    key={m}
                    layout={modulosVisiblesSheet.length <= 50 || undefined}
                    initial={reducedMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reducedMotion ? undefined : { opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={active}
                      onClick={() => toggleModulo(m)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-muted transition-colors"
                      style={{
                        backgroundColor: active ? 'var(--accent)' : undefined,
                        transitionDuration: 'var(--motion-fast)',
                      }}
                    >
                      <span
                        className="flex-shrink-0 w-4 h-4 rounded-[4px] border flex items-center justify-center"
                        style={{
                          backgroundColor: active ? 'var(--primary)' : 'var(--input-background)',
                          borderColor: active ? 'var(--primary)' : 'var(--border)',
                        }}
                      >
                        {active && (
                          <motion.span
                            initial={reducedMotion ? false : { scale: 0.6 }}
                            animate={{ scale: 1 }}
                            transition={reducedMotion ? { duration: 0 } : SPRING_SUAVE}
                            className="flex items-center justify-center"
                          >
                            <Check className="w-3 h-3" style={{ color: 'var(--primary-foreground)' }} />
                          </motion.span>
                        )}
                      </span>
                      <span className="flex-1 min-w-0 text-sm truncate" style={{ fontWeight: active ? 600 : 400 }}>
                        {resaltarCoincidenciaModulo(nombreModulo(m), busquedaModulos)}
                      </span>
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>{m}</span>
                    </button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border flex-shrink-0">
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {filtroModulos.size} de {modulosDisponibles.length} módulos
          </p>
          <button
            type="button"
            onClick={cerrarModulosSheet}
            className="h-9 px-5 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 600 }}
          >
            Listo
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
