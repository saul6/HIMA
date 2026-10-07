import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (needRefresh) setVisible(true)
  }, [needRefresh])

  if (!visible) return null

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border border-border shadow-sm"
      style={{ backgroundColor: 'var(--card)', maxWidth: '90vw' }}
    >
      <p className="text-sm" style={{ color: 'var(--foreground)' }}>
        Hay una versión nueva disponible
      </p>
      <button
        onClick={() => { updateServiceWorker(true); setVisible(false) }}
        className="text-sm px-3 py-1.5 rounded-lg"
        style={{
          backgroundColor: 'var(--primary)',
          color: '#fff',
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        Actualizar
      </button>
      <button
        onClick={() => setVisible(false)}
        className="text-xs"
        style={{ color: 'var(--muted-foreground)', flexShrink: 0 }}
      >
        Ahora no
      </button>
    </div>
  )
}
