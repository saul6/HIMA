import { useCallback, useEffect, useRef, useState } from 'react'

// Solo una pestaña edita un borrador a la vez. Con `activo` la pestaña pide el
// candado `m13-borrador:<clave>`; si otra lo tiene, queda en solo lectura hasta
// que el usuario toque "Usar aquí" (la otra suelta el candado y pasa a lectura).
// Sin Web Locks se asume dueña (comportamiento anterior).

export function useLockBorrador(clave: string | null, activo: boolean, alTomar?: () => void) {
  const [esDueno, setEsDueno] = useState(true)
  const esDuenoRef = useRef(true)
  const soltarRef = useRef<(() => void) | null>(null)
  const alTomarRef = useRef(alTomar)
  alTomarRef.current = alTomar
  const alSoltarAntesRef = useRef<(() => Promise<void>) | null>(null)

  const fijar = (v: boolean) => { esDuenoRef.current = v; setEsDueno(v) }

  const soltar = useCallback(() => {
    soltarRef.current?.()
    soltarRef.current = null
  }, [])

  const pedir = useCallback((esperar: boolean) => {
    if (!clave || !('locks' in navigator)) { fijar(true); return }
    const nombre = `m13-borrador:${clave}`
    void navigator.locks.request(nombre, esperar ? {} : { ifAvailable: true }, (lock) => {
      if (!lock) { fijar(false); return }
      fijar(true)
      if (esperar) alTomarRef.current?.()
      return new Promise<void>((resolve) => { soltarRef.current = resolve })
    }).catch(() => fijar(true))
  }, [clave])

  useEffect(() => {
    if (!clave || !activo) return
    pedir(false)
    let canal: BroadcastChannel | null = null
    try {
      canal = new BroadcastChannel('m13-borrador')
      canal.onmessage = async (ev) => {
        if (ev.data?.tipo !== 'tomar' || ev.data?.clave !== clave || !esDuenoRef.current) return
        // Termina de escribir lo pendiente y suelta: desde aquí esta pestaña solo lee.
        try { await alSoltarAntesRef.current?.() } catch { /* ignore */ }
        fijar(false)
        soltar()
      }
    } catch { /* sin BroadcastChannel */ }
    return () => {
      canal?.close()
      soltar()
      fijar(true)
    }
  }, [clave, activo, pedir, soltar])

  const usarAqui = useCallback(() => {
    if (!clave) return
    try {
      const canal = new BroadcastChannel('m13-borrador')
      canal.postMessage({ tipo: 'tomar', clave })
      canal.close()
    } catch { /* ignore */ }
    pedir(true)
  }, [clave, pedir])

  return {
    esDueno,
    esDuenoRef,
    usarAqui,
    /** Función que se ejecuta antes de soltar el candado (vaciar escrituras pendientes). */
    antesDeSoltar: (fn: () => Promise<void>) => { alSoltarAntesRef.current = fn },
  }
}
