import { supabase } from '@/lib/supabase'

// Diagnóstico de fallas del teléfono → tabla `cliente_eventos` (solo super_admin lee).
// Sin conexión (o si falla el envío) el evento queda en una cola local y se manda
// cuando vuelve el disparador de sincronización. Nunca lanza error a la pantalla.
// En `detalle` solo van tamaños, megapíxeles, etapa, versión y estado de red:
// nada personal ni fotos.

const CLAVE_COLA = 'mady:cliente_eventos'
const MAX_COLA = 50
const MAX_EDAD_MS = 7 * 24 * 60 * 60 * 1000

interface EventoCliente {
  org_id: string | null
  modulo: string
  etapa: string
  detalle: Record<string, unknown>
  dispositivo: string
  ocurrido_en: string
}

function leerCola(): EventoCliente[] {
  try {
    const raw = localStorage.getItem(CLAVE_COLA)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function guardarCola(cola: EventoCliente[]) {
  try {
    if (cola.length === 0) localStorage.removeItem(CLAVE_COLA)
    else localStorage.setItem(CLAVE_COLA, JSON.stringify(cola.slice(-MAX_COLA)))
  } catch { /* ignore */ }
}

async function enviar(eventos: EventoCliente[]): Promise<boolean> {
  try {
    const { error } = await supabase.from('cliente_eventos' as never).insert(eventos as never)
    return !error
  } catch {
    return false
  }
}

export function registrarEvento(
  modulo: string,
  etapa: string,
  detalle: Record<string, unknown> = {},
  orgId?: string | null,
): void {
  try {
    const evento: EventoCliente = {
      org_id: orgId ?? null,
      modulo: modulo.slice(0, 20),
      etapa: etapa.slice(0, 60),
      detalle: { ...detalle, version: __APP_VERSION__, online: navigator.onLine },
      dispositivo: (navigator.userAgent || '').slice(0, 400),
      ocurrido_en: new Date().toISOString(),
    }
    if (JSON.stringify(evento.detalle).length > 4000) evento.detalle = { truncado: true, version: __APP_VERSION__ }
    void (async () => {
      if (navigator.onLine && (await enviar([evento]))) return
      guardarCola([...leerCola(), evento])
    })().catch(() => {})
  } catch { /* ignore */ }
}

// Manda los eventos acumulados sin conexión. Lo llama el disparador de sync.
let vaciando = false
export async function vaciarColaEventos(): Promise<void> {
  if (vaciando || !navigator.onLine) return
  const cola = leerCola().filter((e) => Date.now() - Date.parse(e.ocurrido_en) < MAX_EDAD_MS)
  if (cola.length === 0) { guardarCola([]); return }
  vaciando = true
  try {
    if (await enviar(cola)) {
      // Conserva lo que se haya encolado mientras se enviaba
      const enviados = new Set(cola.map((e) => e.ocurrido_en + e.etapa))
      guardarCola(leerCola().filter((e) => !enviados.has(e.ocurrido_en + e.etapa)))
    }
  } finally {
    vaciando = false
  }
}
