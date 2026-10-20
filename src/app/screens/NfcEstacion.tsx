// Pantalla de entrada NFC para el módulo M21 — Monitoreo de Plagas.
// URL: /nfc/:token
// Llama a la RPC resolver_nfc_estacion y redirige a M21 con la estación
// preseleccionada, o muestra el estado de error / upsell correspondiente.

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Loader2, Bug, AlertTriangle, ShieldX, PowerOff, WifiOff } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { resolverNfcOffline } from '@/lib/offline/resolverNfcOffline'
import { Boton } from '@/app/components/ui-mady/Boton'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type NfcMotivo = 'TOKEN_INVALIDO' | 'FUNCION_NO_ACTIVA' | 'SIN_ACCESO' | 'ESTACION_INACTIVA'

type NfcRespuesta =
  | { ok: true; estacion_id: string; rancho_id: string; tipo_trampa: string; numero: string; ruta: string }
  | { ok: false; motivo: NfcMotivo }

// ── Mensajes por motivo ───────────────────────────────────────────────────────

const MENSAJES: Record<NfcMotivo, {
  titulo: string
  descripcion: string
  esUpsell: boolean
}> = {
  FUNCION_NO_ACTIVA: {
    titulo: 'Función no incluida en tu plan',
    descripcion: 'La lectura por NFC de trampas es una función adicional que no está incluida en tu plan actual. Contáctanos para activarla.',
    esUpsell: true,
  },
  TOKEN_INVALIDO: {
    titulo: 'Chip no reconocido',
    descripcion: 'Verifica que la trampa esté registrada correctamente en el sistema.',
    esUpsell: false,
  },
  SIN_ACCESO: {
    titulo: 'Sin acceso',
    descripcion: 'Este chip pertenece a otra organización.',
    esUpsell: false,
  },
  ESTACION_INACTIVA: {
    titulo: 'Estación inactiva',
    descripcion: 'Esta estación está marcada como inactiva. Actívala desde la configuración de estaciones en Monitoreo de Plagas.',
    esUpsell: false,
  },
}

const ICONOS: Record<NfcMotivo, React.ComponentType<{ className?: string }>> = {
  FUNCION_NO_ACTIVA: AlertTriangle,
  TOKEN_INVALIDO: Bug,
  SIN_ACCESO: ShieldX,
  ESTACION_INACTIVA: PowerOff,
}

// ── Componente ────────────────────────────────────────────────────────────────

type Estado = 'cargando' | 'error_red' | 'resultado'

export function NfcEstacion() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuthContext()

  const [estado, setEstado] = useState<Estado>('cargando')
  const [respuesta, setRespuesta] = useState<Extract<NfcRespuesta, { ok: false }> | null>(null)
  const [reintentar, setReintentar] = useState(0)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      navigate(`/login?returnTo=/nfc/${token}`, { replace: true })
      return
    }

    let cancelado = false

    async function resolver() {
      setEstado('cargando')
      try {
        let res: NfcRespuesta | null = null
        // Con red sigue llamando a la RPC; sin red (o si la red falla) usa las estaciones en caché
        if (navigator.onLine) {
          try {
            const { data, error } = await supabase.rpc('resolver_nfc_estacion', { p_token: token })
            if (error) throw error
            res = data as NfcRespuesta
          } catch (e) {
            if (!user?.id || !profile?.org_id) throw e
            res = await resolverNfcOffline(token ?? '', user.id, profile.org_id)
            if (!res) throw e
          }
        } else {
          if (!user?.id || !profile?.org_id) throw new Error('Sin organización')
          res = await resolverNfcOffline(token ?? '', user.id, profile.org_id)
          if (!res) throw new Error('Sin conexión y sin estaciones en caché')
        }
        if (!res) throw new Error('Sin respuesta')
        if (cancelado) return
        if (res.ok) {
          navigate(
            `/inocuidad/monitoreo-plagas?estacion=${res.estacion_id}&rancho=${res.rancho_id}`,
            { replace: true }
          )
        } else {
          setRespuesta(res)
          setEstado('resultado')
        }
      } catch {
        if (!cancelado) setEstado('error_red')
      }
    }

    resolver()
    return () => { cancelado = true }
  }, [authLoading, user, profile?.org_id, token, reintentar])

  // ── Cargando ────────────────────────────────────────────────────────────────

  if (authLoading || estado === 'cargando') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-5 px-6 bg-background">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--agro-success-fill)' }}
        >
          <Bug className="w-8 h-8" style={{ color: 'var(--agro-success-text)' }} />
        </div>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--primary)' }} />
        <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
          Leyendo la trampa…
        </p>
      </div>
    )
  }

  // ── Error de red ────────────────────────────────────────────────────────────

  if (estado === 'error_red') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-6 px-6 bg-background">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--muted)' }}
        >
          <WifiOff className="w-8 h-8" style={{ color: 'var(--muted-foreground)' }} />
        </div>
        <div className="text-center space-y-1.5 max-w-xs">
          <p className="font-semibold text-foreground">Sin conexión</p>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            No se pudo leer la trampa. Verifica tu conexión e intenta de nuevo.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Boton onClick={() => setReintentar(n => n + 1)} className="w-full">
            Reintentar
          </Boton>
          <button
            onClick={() => navigate('/')}
            className="w-full h-12 rounded-2xl border text-sm transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            Ir al inicio
          </button>
        </div>
      </div>
    )
  }

  // ── Resultado con motivo de rechazo ─────────────────────────────────────────

  const res = respuesta!
  const info = MENSAJES[res.motivo]
  const Icono = ICONOS[res.motivo]

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 px-6 bg-background">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{
          backgroundColor: info.esUpsell ? 'var(--agro-info-fill)' : 'var(--agro-danger-fill)',
          color: info.esUpsell ? 'var(--agro-info-text)' : 'var(--agro-danger-text)',
        }}
      >
        <Icono className="w-8 h-8" />
      </div>

      <div className="text-center space-y-2 max-w-xs">
        <p className="font-semibold text-foreground">{info.titulo}</p>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {info.descripcion}
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {info.esUpsell ? (
          <Boton onClick={() => navigate('/')} className="w-full">
            Ir al inicio
          </Boton>
        ) : (
          <Boton onClick={() => navigate('/inocuidad/monitoreo-plagas')} className="w-full">
            Ir a Monitoreo de Plagas
          </Boton>
        )}
        <button
          onClick={() => navigate('/')}
          className="w-full h-12 rounded-2xl border text-sm transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
        >
          Ir al inicio
        </button>
      </div>
    </div>
  )
}
