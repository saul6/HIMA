import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { ChevronLeft, FileText, Package, Loader2, FilterX } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
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

// ── Cargador de índice (8 consultas en paralelo) ──────────────────────────────

async function cargarTodo(orgId: string, desde: string, hasta: string): Promise<RegistroHistorial[]> {
  const desdeM = desde.slice(0, 7) + '-01'
  const hastaM = hasta.slice(0, 7) + '-01'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tbl = (name: string) => (supabase as any).from(name)

  const [r1, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16, r17, r18, r19, r20, r21, r22, r23, r24, r25, r26, r27, r28, r29, r30, r31, r32, r33, r34, r35, r38, r39, r40, r41, r42, r43, r44] = await Promise.all([
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
    tbl('acciones_correctivas')
      .select('id, codigo_pregunta, no_conformidad, fecha_deteccion, estado, auditoria_visitas!visita_id(rancho_id, ranchos!rancho_id(nombre))')
      .eq('org_id', orgId).gte('created_at', desde + 'T00:00:00').lte('created_at', hasta + 'T23:59:59')
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

  // M26 — una fila = una accion correctiva
  for (const r of (r26 as any)?.data ?? []) {
    const visita = (r.auditoria_visitas as any)
    todos.push({
      key: `M26-${r.id}`,
      modulo: 'M26',
      rancho_id: visita?.rancho_id ?? null,
      rancho_nombre: visita?.ranchos?.nombre ?? '—',
      fecha: r.fecha_deteccion ?? r.created_at?.split('T')[0] ?? '',
      resumen: `${r.codigo_pregunta}: ${(r.no_conformidad as string | null)?.slice(0, 80) ?? '—'}`,
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
  const { profile } = useAuthContext()
  const orgId = profile?.org_id ?? ''
  const { modulos: misModulos, terminosSitio } = useModulosContext()

  // Módulos accesibles para este usuario (excluye historial, ordenados por orden)
  const modulosDisponibles = useMemo<ModuloKey[]>(() => {
    return misModulos
      .filter(m => m.clave !== 'historial' && m.codigo in MODULO_META)
      .sort((a, b) => a.orden - b.orden)
      .map(m => m.codigo as ModuloKey)
  }, [misModulos])

  // Rango de búsqueda (se actualiza al presionar Buscar)
  const [inputDesde, setInputDesde] = useState(inicioRango)
  const [inputHasta, setInputHasta] = useState(hoy)
  const [buscarDesde, setBuscarDesde] = useState(inicioRango)
  const [buscarHasta, setBuscarHasta] = useState(hoy)

  // Filtros client-side: inicializados con todos los módulos del usuario
  const [filtroModulos, setFiltroModulos] = useState<Set<ModuloKey>>(
    () => new Set(modulosDisponibles),
  )
  const modulosSyncedRef = useRef(false)
  useEffect(() => {
    if (!modulosSyncedRef.current && modulosDisponibles.length > 0) {
      modulosSyncedRef.current = true
      setFiltroModulos(new Set(modulosDisponibles))
    }
  }, [modulosDisponibles])

  const [filtroRancho, setFiltroRancho] = useState<string>('todos')

  // Datos
  const [registros, setRegistros] = useState<RegistroHistorial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // PDF state
  const [descargandoPDF, setDescargandoPDF] = useState<string | null>(null)
  const [generandoPaquete, setGenerandoPaquete] = useState(false)
  const [progresoActual, setProgresoActual] = useState(0)
  const [progresoTotal, setProgresoTotal] = useState(0)

  const cargar = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    try {
      const data = await cargarTodo(orgId, buscarDesde, buscarHasta)
      setRegistros(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar los registros')
    } finally {
      setLoading(false)
    }
  }, [orgId, buscarDesde, buscarHasta])

  useEffect(() => { cargar() }, [cargar])

  // Ranchos únicos presentes en los resultados
  const ranchos = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of registros) {
      if (r.rancho_id && !map.has(r.rancho_id)) {
        map.set(r.rancho_id, r.rancho_nombre)
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [registros])

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
        if (next.size > 1) next.delete(m)
      } else {
        next.add(m)
      }
      return next
    })
  }

  async function handleDescargarPDF(reg: RegistroHistorial) {
    setDescargandoPDF(reg.key)
    try {
      const blob = await generarBlobParaRef(reg.pdfRef, orgId)
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
        const blob = await generarBlobParaRef(filtrados[i].pdfRef, orgId)
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
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-[390px] mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-black/10">
          <FileText className="w-5 h-5" style={{ color: 'var(--primary)' }} />
          <h1 className="text-[17px] flex-1" style={{ fontWeight: 600 }}>Historial de Registros</h1>
        </div>

        <div className="p-4 space-y-4 pb-28">

          {/* Rango de fechas */}
          <div className="bg-white rounded-xl border border-black/8 p-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              Periodo
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Desde</label>
                <input
                  type="date"
                  value={inputDesde}
                  onChange={(e) => setInputDesde(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm border"
                  style={{ background: 'var(--input-background)', borderColor: 'var(--border)' }}
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Hasta</label>
                <input
                  type="date"
                  value={inputHasta}
                  onChange={(e) => setInputHasta(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm border"
                  style={{ background: 'var(--input-background)', borderColor: 'var(--border)' }}
                />
              </div>
            </div>
            <button
              onClick={() => { setBuscarDesde(inputDesde); setBuscarHasta(inputHasta) }}
              disabled={loading}
              className="w-full h-9 rounded-lg text-sm text-white disabled:opacity-50"
              style={{ background: 'var(--primary)', fontWeight: 600 }}
            >
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-xl border border-black/8 p-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              Filtros
            </p>

            {/* Rancho */}
            <div>
              <label className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{terminosSitio.singular}</label>
              <select
                value={filtroRancho}
                onChange={(e) => setFiltroRancho(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm border"
                style={{ background: 'var(--input-background)', borderColor: 'var(--border)' }}
              >
                <option value="todos">{terminosSitio.plural}</option>
                {ranchos.map(([id, nombre]) => (
                  <option key={id} value={id}>{nombre}</option>
                ))}
              </select>
            </div>

            {/* Módulos */}
            <div>
              <label className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Módulos</label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {modulosDisponibles.map((m) => {
                  const active = filtroModulos.has(m)
                  return (
                    <button
                      key={m}
                      onClick={() => toggleModulo(m)}
                      className="px-2.5 py-1 rounded-full text-[11px] border transition-all"
                      style={{
                        backgroundColor: active ? MODULO_META[m].color : 'transparent',
                        color: active ? '#fff' : MODULO_META[m].color,
                        borderColor: MODULO_META[m].color,
                        fontWeight: 600,
                        opacity: active ? 1 : 0.55,
                      }}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Exportar paquete */}
          {filtrados.length > 0 && (
            <button
              onClick={handleExportarPaquete}
              disabled={generandoPaquete || !!descargandoPDF}
              className="w-full h-11 rounded-xl text-sm flex items-center justify-center gap-2 border disabled:opacity-50"
              style={{
                borderColor: 'var(--primary)',
                color: 'var(--primary)',
                fontWeight: 600,
              }}
            >
              <Package className="w-4 h-4" />
              Exportar paquete PDF ({filtrados.length} registros)
            </button>
          )}

          {/* Lista de registros */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-red-600">{error}</div>
          ) : filtrados.length === 0 ? (
            <div className="py-14 text-center space-y-2">
              <FilterX className="w-10 h-10 mx-auto" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Sin registros en este periodo
              </p>
              <p className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                Prueba un rango de fechas más amplio
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtrados.map((reg) => (
                <div
                  key={reg.key}
                  className="bg-white rounded-xl border border-black/8 p-3.5 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
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
                    <p className="text-[13px] truncate" style={{ fontWeight: 600 }}>
                      {reg.rancho_nombre}
                    </p>
                    <p className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                      {formatFecha(reg.fecha)}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
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
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Overlay de progreso */}
      {generandoPaquete && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="bg-white rounded-2xl p-6 mx-4 w-full max-w-xs text-center space-y-4">
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
      )}
    </div>
  )
}
