import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import {
  esSeguroActualizar,
  SEGURIDAD_CAMBIO_EVENT,
  ventanasAbiertas,
  señalarUpdateDisponible,
} from '@/lib/offline/actualizacionSegura'

export function PwaUpdatePrompt() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) registrationRef.current = reg
    },
  })

  const [visible, setVisible] = useState(false)

  // Revisión periódica de actualizaciones: cada 30 min y al volver a primer plano
  useEffect(() => {
    const checkUpdate = () => {
      if (navigator.onLine && registrationRef.current) {
        registrationRef.current.update().catch(() => {})
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkUpdate()
    }
    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(checkUpdate, 30 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [])

  // Expone el estado de update al resto de la app (Perfil)
  useEffect(() => {
    señalarUpdateDisponible(needRefresh, () => updateServiceWorker(true))
  }, [needRefresh, updateServiceWorker])

  // Política de actualización: automática cuando es seguro, aviso si no lo es
  useEffect(() => {
    if (!needRefresh) {
      setVisible(false)
      return
    }

    // Intento inicial tras 1s para dar tiempo a que el estado se estabilice.
    // Si es seguro → actualización silenciosa. Si no → muestra el aviso.
    const t = setTimeout(() => {
      if (esSeguroActualizar()) {
        updateServiceWorker(true)
      } else {
        setVisible(true)
      }
    }, 1000)

    // En paralelo: escucha cambios de estado (BottomSheet cierra, sync termina)
    // y actualiza en cuanto sea seguro, sin esperar al usuario.
    const tryAutoUpdate = () => {
      if (esSeguroActualizar()) updateServiceWorker(true)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') tryAutoUpdate()
    }
    window.addEventListener(SEGURIDAD_CAMBIO_EVENT, tryAutoUpdate)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(t)
      window.removeEventListener(SEGURIDAD_CAMBIO_EVENT, tryAutoUpdate)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [needRefresh, updateServiceWorker])

  const handleActualizarAhora = () => {
    if (ventanasAbiertas() > 0) {
      if (!window.confirm('Se perderá lo que no hayas guardado. ¿Actualizar?')) return
    }
    updateServiceWorker(true)
  }

  if (!visible) return null

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border border-border"
      style={{ backgroundColor: 'var(--card)', maxWidth: '90vw' }}
    >
      <p className="text-sm flex-1" style={{ color: 'var(--foreground)' }}>
        Hay una versión nueva. Se aplicará al cerrar lo que estás capturando.
      </p>
      <button
        onClick={handleActualizarAhora}
        className="text-sm px-3 py-1.5 rounded-lg"
        style={{
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-foreground)',
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        Actualizar ahora
      </button>
    </div>
  )
}
