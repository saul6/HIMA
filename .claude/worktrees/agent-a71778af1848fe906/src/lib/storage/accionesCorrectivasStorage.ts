import { supabase } from '@/lib/supabase'

const BUCKET = 'acciones-correctivas'

export async function subirFotoAccion(path: string, file: File): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
}

export async function getSignedUrlAccion(path: string, ttl = 120): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttl)
  if (error || !data?.signedUrl) throw error ?? new Error('No signed URL')
  return data.signedUrl
}

export async function getSignedUrlsAccion(
  paths: string[],
  ttl = 120
): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, ttl)
  if (error) throw error
  const result: Record<string, string> = {}
  for (const item of data ?? []) {
    if (item.signedUrl) result[item.path] = item.signedUrl
  }
  return result
}

export async function borrarFotosAccion(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw error
}

export async function fotoAccionADataUri(path: string): Promise<string> {
  const url = await getSignedUrlAccion(path, 120)
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function fotosAccionADataUris(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const results = await Promise.allSettled(
    paths.map(async (p) => ({ path: p, uri: await fotoAccionADataUri(p) }))
  )
  const out: Record<string, string> = {}
  for (const r of results) {
    if (r.status === 'fulfilled') out[r.value.path] = r.value.uri
  }
  return out
}
