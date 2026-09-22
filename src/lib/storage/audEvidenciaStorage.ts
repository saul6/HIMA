import { supabase } from '@/lib/supabase'

const BUCKET = 'auditoria-evidencia'

export async function subirEvidencia(path: string, file: File): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (error) throw error
}

export async function getSignedUrlEvidencia(path: string, ttl = 300): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttl)
  if (error || !data?.signedUrl) throw error ?? new Error('No signed URL')
  return data.signedUrl
}
