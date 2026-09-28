import { supabase } from '@/lib/supabase'

const BUCKET = 'agenda-evidencia'

export async function subirEvidencia(path: string, file: File): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
}

export async function getSignedUrlEvidencia(path: string, ttl = 300): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, ttl)
  if (error || !data?.signedUrl) throw error ?? new Error('No signed URL')
  return data.signedUrl
}

export async function getSignedUrlsEvidencia(
  paths: string[],
  ttl = 300,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, ttl)
  if (error) throw error
  const result: Record<string, string> = {}
  for (const item of data ?? []) {
    if (item.signedUrl) result[item.path] = item.signedUrl
  }
  return result
}
