/**
 * Seed idempotente: catálogos ANEBERRIES (Frambuesa, Fresa, Mora azul) → Supabase
 *
 * Uso:
 *   pnpm seed:aneberries:todos
 *
 * Requiere en .env:
 *   VITE_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...  ← bypasea RLS; nunca expongas esta key en el frontend
 *
 * El script es idempotente: re-ejecutarlo no duplica datos (upsert por clave natural).
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// --- Validar configuración ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: Faltan variables de entorno.')
  console.error('  VITE_SUPABASE_URL        ->', SUPABASE_URL ? 'presente' : 'FALTA')
  console.error('  SUPABASE_SERVICE_ROLE_KEY ->', SERVICE_KEY  ? 'presente' : 'FALTA')
  process.exit(1)
}

if (!SUPABASE_URL.includes('glrjesvtsspilkacooln')) {
  console.error(`ERROR: La URL apunta a un proyecto distinto de glrjesvtsspilkacooln.`)
  console.error(`  URL detectada: ${SUPABASE_URL}`)
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// --- Archivos a procesar (orden definido) ---
const ARCHIVOS = [
  { json: '../aneberries_frambuesa.json',  cultivo: 'Frambuesa' },
  { json: '../aneberries_fresa.json',      cultivo: 'Fresa'     },
  { json: '../aneberries_moraazul.json',   cultivo: 'Mora azul' },
]

// --- Tipos del JSON ---
interface RawProducto {
  nombre_comercial:  string
  ingrediente_activo: string | null
  concentracion:     string | null
  empresa:           string | null
  rsco:              string | null
  categoria:         string
  unidad:            string | null
}

interface RawAutorizacion {
  producto_key: { nombre_comercial: string; ingrediente_activo: string | null }
  cultivo:                  string
  mercado:                  string
  intervalo_seguridad_dias: number | null
  reentrada_hrs:            number | null
  lmr_ppm:                  string | null
  dosis_texto:              string | null
  dosis_min:                number | null
  dosis_max:                number | null
  intervalo_aplicacion:     string | null
  grupo_quimico:            string | null
  plaga_comun:              string | null
  plaga_cientifica:         string | null
  observaciones:            string | null
  revision_lista:           string
  fecha_lista:              string
}

// --- Helpers ---
const BATCH = 100
const DOSIS_FALLBACK = 'No especificada en lista'

async function getCount(table: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
  if (error) throw new Error(`count(${table}): ${error.message}`)
  return count ?? 0
}

async function upsertBatched(
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict })
    if (error) {
      throw new Error(`[${table}] lote ${i}–${i + batch.length - 1}: ${error.message}`)
    }
  }
}

// Construir mapa global nombre_comercial||ingrediente_activo → uuid
async function buildProductoMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('catalogo_productos')
    .select('id, nombre_comercial, ingrediente_activo')
  if (error) throw new Error(`fetch catalogo_productos: ${error.message}`)
  const map = new Map<string, string>()
  for (const p of data ?? []) {
    map.set(`${p.nombre_comercial}||${p.ingrediente_activo ?? ''}`, p.id as string)
  }
  return map
}

// --- Main ---
async function main() {
  console.log('Seed: ANEBERRIES — Frambuesa, Fresa, Mora azul')
  console.log(`Proyecto: ${SUPABASE_URL}`)
  console.log()

  let totalPInsertados   = 0
  let totalPActualizados = 0
  let totalAInsertadas   = 0
  let totalAActualizadas = 0
  let totalDosisFallback = 0
  let totalSinMatch      = 0

  for (const archivo of ARCHIVOS) {
    const jsonPath = join(__dirname, archivo.json)
    const data = JSON.parse(readFileSync(jsonPath, 'utf-8'))

    console.log(`--- ${archivo.cultivo} (${data.meta.cultivos?.join(', ')}) ---`)

    // ── 1. catalogo_productos ──────────────────────────────
    const rawProductos: RawProducto[] = data.catalogo_productos
    const productosPayload = rawProductos.map(p => ({
      nombre_comercial:  p.nombre_comercial,
      // La BD tiene NOT NULL en ingrediente_activo; '' para productos sin IA conocido
      ingrediente_activo: p.ingrediente_activo ?? '',
      concentracion:     p.concentracion ?? null,
      empresa:           p.empresa       ?? null,
      rsco:              p.rsco          ?? null,
      categoria:         p.categoria,
      unidad:            p.unidad        ?? null,
    }))

    const antesP  = await getCount('catalogo_productos')
    await upsertBatched(
      'catalogo_productos',
      productosPayload,
      'nombre_comercial,ingrediente_activo',
    )
    const despuesP = await getCount('catalogo_productos')

    const pInsertados   = despuesP - antesP
    const pActualizados = productosPayload.length - pInsertados
    totalPInsertados   += pInsertados
    totalPActualizados += pActualizados
    console.log(`  catalogo_productos     — insertados: ${pInsertados}, actualizados (reuso): ${pActualizados}`)

    // ── 2. producto_autorizaciones ─────────────────────────
    // Reconstruir mapa tras cada upsert (puede haber nuevos IDs)
    const productoMap = await buildProductoMap()

    const rawAuts: RawAutorizacion[] = data.producto_autorizaciones
    const autsPayload: Record<string, unknown>[] = []
    let sinMatch      = 0
    let dosisFallback = 0

    for (const a of rawAuts) {
      const ia     = a.producto_key.ingrediente_activo ?? ''
      const mapKey = `${a.producto_key.nombre_comercial}||${ia}`
      const productoId = productoMap.get(mapKey)

      if (!productoId) {
        console.warn(`  WARN sin match: "${a.producto_key.nombre_comercial}" / "${ia}"`)
        sinMatch++
        continue
      }

      // Transformación obligatoria: dosis_texto NOT NULL
      const dosisTexto  = (a.dosis_texto && a.dosis_texto.trim())
        ? a.dosis_texto
        : DOSIS_FALLBACK
      const dosisFilled = dosisTexto === DOSIS_FALLBACK
      if (dosisFilled) dosisFallback++

      autsPayload.push({
        producto_id:              productoId,
        cultivo:                  a.cultivo,
        mercado:                  a.mercado,
        intervalo_seguridad_dias: a.intervalo_seguridad_dias ?? null,
        reentrada_hrs:            a.reentrada_hrs            ?? null,
        lmr_ppm:                  a.lmr_ppm                  ?? null,
        dosis_texto:              dosisTexto,
        // Si se usó fallback, los rangos no son reales → null
        dosis_min:                dosisFilled ? null : (a.dosis_min ?? null),
        dosis_max:                dosisFilled ? null : (a.dosis_max ?? null),
        intervalo_aplicacion:     a.intervalo_aplicacion     ?? null,
        grupo_quimico:            a.grupo_quimico            ?? null,
        plaga_comun:              a.plaga_comun              ?? null,
        plaga_cientifica:         a.plaga_cientifica         ?? null,
        observaciones:            a.observaciones            ?? null,
        revision_lista:           a.revision_lista,
        fecha_lista:              a.fecha_lista,
      })
    }

    // Deduplicar por clave natural antes del upsert.
    // El unique constraint es (producto_id, cultivo, mercado, revision_lista).
    // Cuando un producto tiene varias filas de plagas en el PDF, nos quedamos
    // con la primera (más completa) y concatenamos las plagas adicionales.
    const dedupMap = new Map<string, Record<string, unknown>>()
    for (const row of autsPayload) {
      const k = `${row.producto_id}||${row.cultivo}||${row.mercado}||${row.revision_lista}`
      if (!dedupMap.has(k)) {
        dedupMap.set(k, { ...row })
      } else {
        // Concatenar plagas adicionales en la fila existente
        const existing = dedupMap.get(k)!
        if (row.plaga_comun && row.plaga_comun !== existing.plaga_comun) {
          existing.plaga_comun = existing.plaga_comun
            ? `${existing.plaga_comun} / ${row.plaga_comun}`
            : row.plaga_comun
        }
        if (row.plaga_cientifica && row.plaga_cientifica !== existing.plaga_cientifica) {
          existing.plaga_cientifica = existing.plaga_cientifica
            ? `${existing.plaga_cientifica} / ${row.plaga_cientifica}`
            : row.plaga_cientifica
        }
      }
    }
    const autsDedupe = Array.from(dedupMap.values())
    const dupsEliminados = autsPayload.length - autsDedupe.length
    if (dupsEliminados > 0)
      console.log(`  filas deduplicadas (plagas concatenadas): ${dupsEliminados}`)

    const antesA   = await getCount('producto_autorizaciones')
    await upsertBatched(
      'producto_autorizaciones',
      autsDedupe,
      'producto_id,cultivo,mercado,revision_lista',
    )
    const despuesA = await getCount('producto_autorizaciones')

    const aInsertadas   = despuesA - antesA
    const aActualizadas = autsDedupe.length - aInsertadas
    totalAInsertadas   += aInsertadas
    totalAActualizadas += aActualizadas
    totalDosisFallback += dosisFallback
    totalSinMatch      += sinMatch

    console.log(`  producto_autorizaciones — insertadas: ${aInsertadas}, actualizadas: ${aActualizadas}`)
    console.log(`  dosis rellenadas con fallback: ${dosisFallback}`)
    if (sinMatch > 0)
      console.log(`  WARN autorizaciones sin match de producto: ${sinMatch}`)
    console.log()
  }

  console.log('=== TOTALES ===')
  console.log(`  catalogo_productos     — insertados: ${totalPInsertados}, actualizados (reuso): ${totalPActualizados}`)
  console.log(`  producto_autorizaciones — insertadas: ${totalAInsertadas}, actualizadas: ${totalAActualizadas}`)
  console.log(`  dosis rellenadas con "No especificada en lista": ${totalDosisFallback}`)
  if (totalSinMatch > 0)
    console.log(`  WARN autorizaciones sin match: ${totalSinMatch}`)
  else
    console.log(`  Sin match de producto: 0 (OK)`)
  console.log()
  console.log('Seed completado.')
}

main().catch(err => {
  console.error('\nError fatal:', (err as Error).message)
  process.exit(1)
})
