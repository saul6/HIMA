import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { SPRING_SUAVE } from '@/lib/motion'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

interface Notif {
  id: string
  tipo: string
  titulo: string
  cuerpo: string | null
  url: string | null
  leida: boolean
  programada_para: string
  created_at: string
}

export function CampanaNotificaciones() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (!profile?.id) return
    cargar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  async function cargar() {
    const ahora = new Date().toISOString()
    try {
      const { count } = await tbl('aud_notificaciones')
        .select('id', { count: 'exact', head: true })
        .eq('leida', false)
        .lte('programada_para', ahora)
      setNoLeidas(count ?? 0)

      const { data } = await tbl('aud_notificaciones')
        .select('id, tipo, titulo, cuerpo, url, leida, programada_para, created_at')
        .lte('programada_para', ahora)
        .order('created_at', { ascending: false })
        .limit(30)
      setNotifs(data ?? [])
    } catch (e) {
      console.error('[CampanaNotificaciones]', e)
    }
  }

  async function marcarLeida(notif: Notif) {
    try {
      await tbl('aud_notificaciones').update({ leida: true }).eq('id', notif.id)
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, leida: true } : n))
      setNoLeidas(prev => Math.max(0, prev - (notif.leida ? 0 : 1)))
    } catch (e) {
      console.error('[CampanaNotificaciones] marcarLeida', e)
    }
    setAbierto(false)
    if (notif.url) navigate(notif.url)
  }

  useEffect(() => {
    if (!abierto) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [abierto])

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { if (!abierto) cargar(); setAbierto(o => !o) }}
        className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`Notificaciones${noLeidas > 0 ? ` (${noLeidas} no leídas)` : ''}`}
      >
        <Bell className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
        {noLeidas > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[10px] font-bold px-0.5 leading-none"
            style={{ backgroundColor: 'var(--agro-red)', color: 'var(--primary-foreground)' }}
          >
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      <AnimatePresence>
        {abierto && (
          <div
            className="absolute right-0 top-10 w-72 max-h-96 overflow-hidden rounded-xl border border-border z-50"
            style={{ backgroundColor: 'var(--card)' }}
          >
            <motion.div
              className="max-h-96 overflow-y-auto"
              style={{ transformOrigin: 'top right' }}
              initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1, transition: SPRING_SUAVE }}
              exit={reducedMotion ? undefined : { opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            >
              <div className="px-4 py-3 border-b border-border flex-shrink-0">
                <p className="text-sm" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                  Notificaciones
                  {noLeidas > 0 && (
                    <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>
                      {' '}· {noLeidas} no leída{noLeidas !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>

              {notifs.length === 0 ? (
                <p className="text-xs text-center py-8" style={{ color: 'var(--muted-foreground)' }}>
                  Sin notificaciones
                </p>
              ) : (
                <div>
                  {notifs.map((n, i) => (
                    <motion.button
                      key={n.id}
                      onClick={() => marcarLeida(n)}
                      className="relative w-full text-left px-4 py-3 pl-6 border-b border-border transition-colors hover:bg-muted last:border-b-0 focus-visible:outline-none"
                      style={{ backgroundColor: n.leida ? undefined : 'var(--accent)' }}
                      initial={reducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1, transition: { duration: 0.15, delay: Math.min(i, 5) * 0.03 } }}
                    >
                      {!n.leida && (
                        <span
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: 'var(--secondary)' }}
                        />
                      )}
                      <p
                        className="text-xs leading-tight mb-0.5"
                        style={{
                          fontWeight: n.leida ? 400 : 600,
                          color: n.leida ? 'var(--muted-foreground)' : 'var(--accent-foreground)',
                        }}
                      >
                        {n.titulo}
                      </p>
                      {n.cuerpo && (
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                          {n.cuerpo}
                        </p>
                      )}
                      <p className="text-[10px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
                        {new Date(n.created_at).toLocaleDateString('es-MX', {
                          day: 'numeric', month: 'short',
                        })}
                      </p>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
