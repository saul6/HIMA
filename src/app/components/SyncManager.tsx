import { useEffect } from 'react'
import { useAuthContext } from '@/context/AuthContext'
import { iniciarSyncLoop } from '@/lib/offline/sync'

export function SyncManager() {
  const { user } = useAuthContext()

  useEffect(() => {
    if (!user?.id) return
    const detener = iniciarSyncLoop(user.id)
    return detener
  }, [user?.id])

  return null
}
