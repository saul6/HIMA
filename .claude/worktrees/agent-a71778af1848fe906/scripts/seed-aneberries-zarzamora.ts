/**
 * Seed idempotente: catálogo ANEBERRIES (Zarzamora) → Supabase
 *
 * Uso:
 *   pnpm seed:aneberries
 *
 * Requiere en .env:
 *   VITE_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...  ← bypasea RLS; nunca expongas esta key en el frontend
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
  console.error('  VITE_SUPABASE_URL        →', SUPABASE_URL ? '✓' : '✗ falta')
  console.error('  SUPABASE_SERVICE_ROLE_KEY →', SERVICE_KEY  ? '✓' : '✗ falta')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// --- Leer JSON ---
const JSON_PATH = join(__dirname, '../aneberries_zarzamora.json')
const data = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))

// --- Tipos del JSON ---
interface RawProducto {
  nombre_comercial:  string
  ingrediente_activo: string
  concentracion:     string | null
  empresa:           string | null
  rsco:              string | null
  categoria:         string
  unidad:            string | null
}

interface RawAutorizacion {
  producto_key: { nombre_comercial: string; ingrediente_activo: string }
  cultivo:                  string
  mercado:                  string
  intervalo_seguridad_dias: number | null
  reentrada_hrs:            number | null
  lmr_ppm:                  string | null
  dosis_texto:              string
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

// --- Main ---
async function main() {
  console.log('🌱 Seed: ANEBERRIES Zarzamora')
  console.log(`   Fuente : ${data.meta.fuente}`)
  console.log(`   Nota   : ${data.meta.nota}`)
  console.log()

  // ─── 1. catalogo_productos ──────────────────────────────
  const rawProductos: RawProducto[] = data.catalogo_productos
  const productosPayload = rawProductos.map(p => ({
    nombre_comercial:  p.nombre_comercial,
    ingrediente_activo: p.ingrediente_activo,
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
  console.log(`catalogo_productos     — insertados: ${pInsertados}, actualizados: ${pActualizados}`)

  // ─── 2. producto_autorizaciones ────────────────────────
  // Construir mapa nombre_comercial+ingrediente_activo → uuid
  const { data: todosP, error: fetchErr } = await supabase
    .from('catalogo_productos')
    .select('id, nombre_comercial, ingrediente_activo')
  if (fetchErr) throw new Error(`fetch catalogo_productos: ${fetchErr.message}`)

  const productoMap = new Map<string, string>()
  for (const p of todosP ?? []) {
    productoMap.set(`${p.nombre_comercial}||${p.ingrediente_activo}`, p.id as string)
  }

  const rawAuts: RawAutorizacion[] = data.producto_autorizaciones
  const autsPayload: Record<string, unknown>[] = []
  let sinMatch = 0

  for (const a of rawAuts) {
    const mapKey    = `${a.producto_key.nombre_comercial}||${a.producto_key.ingrediente_activo}`
    const productoId = productoMap.get(mapKey)

    if (!productoId) {
      console.warn(
        `  ⚠ Sin match: "${a.producto_key.nombre_comercial}" / "${a.producto_key.ingrediente_activo}"`,
      )
      sinMatch++
      continue
    }

    autsPayload.push({
      producto_id:              productoId,
      cultivo:                  a.cultivo,
      mercado:                  a.mercado,
      intervalo_seguridad_dias: a.intervalo_seguridad_dias ?? null,
      reentrada_hrs:            a.reentrada_hrs            ?? null,
      lmr_ppm:                  a.lmr_ppm                  ?? null,
      dosis_texto:              a.dosis_texto,
      dosis_min:                a.dosis_min                ?? null,
      dosis_max:                a.dosis_max                ?? null,
      intervalo_aplicacion:     a.intervalo_aplicacion     ?? null,
      grupo_quimico:            a.grupo_quimico            ?? null,
      plaga_comun:              a.plaga_comun              ?? null,
      plaga_cientifica:         a.plaga_cientifica         ?? null,
      observaciones:            a.observaciones            ?? null,
      revision_lista:           a.revision_lista,
      fecha_lista:              a.fecha_lista,
    })
  }

  const antesA   = await getCount('producto_autorizaciones')
  await upsertBatched(
    'producto_autorizaciones',
    autsPayload,
    'producto_id,cultivo,mercado,revision_lista',
  )
  const despuesA = await getCount('producto_autorizaciones')

  const aInsertadas   = despuesA - antesA
  const aActualizadas = autsPayload.length - aInsertadas
  const skippedMsg    = sinMatch > 0 ? `, omitidas (sin match): ${sinMatch}` : ''
  console.log(`producto_autorizaciones — insertadas: ${aInsertadas}, actualizadas: ${aActualizadas}${skippedMsg}`)

  console.log('\n✅ Seed completado.')
}

main().catch(err => {
  console.error('\n❌ Error fatal:', (err as Error).message)
  process.exit(1)
})
