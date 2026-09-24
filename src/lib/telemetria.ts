import { supabase } from '@/lib/supabase'

export function ahora(): number {
  return performance.now()
}

export function segundos(desde: number): number {
  return parseFloat(((performance.now() - desde) / 1000).toFixed(3))
}

export function ms(desde: number): number {
  return Math.round(performance.now() - desde)
}

export function emitirEvento(
  metric: string,
  value: number,
  refs?: {
    auditoriaId?: string | null
    preguntaId?: string | null
    instanciaId?: string | null
  }
): void {
  void (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc('aud_registrar_evento', {
        p_metric: metric,
        p_value: value,
        p_auditoria_id: refs?.auditoriaId ?? null,
        p_pregunta_id: refs?.preguntaId ?? null,
        p_instancia_id: refs?.instanciaId ?? null,
      })
    } catch {
      // fire-and-forget: never blocks UI
    }
  })()
}

// Module-level resume tracking — bridges AuditorHome click to AuditorEjecucion first edit
let _resumeTs: number | null = null
let _resumeClicks = 0

export function markResume(clicksBefore: number): void {
  _resumeTs = ahora()
  _resumeClicks = clicksBefore
}

export function consumeResumeMetrics(): { ts: number; clicks: number } | null {
  if (_resumeTs === null) return null
  const result = { ts: _resumeTs, clicks: _resumeClicks }
  _resumeTs = null
  _resumeClicks = 0
  return result
}
