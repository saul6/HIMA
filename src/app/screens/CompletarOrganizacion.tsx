import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { mensajeErrorBd } from '@/lib/erroresBd'

export function CompletarOrganizacion() {
  const { profile, refreshProfile } = useAuthContext()
  const navigate = useNavigate()
  const location = useLocation()

  // Nombre precargado si viene de Registro.tsx vía navigate state
  const nombreOrgInicial = (location.state as { nombreOrg?: string } | null)?.nombreOrg ?? ''
  const [nombreOrg, setNombreOrg] = useState(nombreOrgInicial)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Si el usuario ya tiene org (completó registro antes), redirigir al inicio
  useEffect(() => {
    if (profile?.org_id) {
      navigate('/', { replace: true })
    }
  }, [profile?.org_id, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!nombreOrg.trim()) return
    setError(null)
    setSubmitting(true)

    try {
      const { error: rpcError } = await supabase.rpc('completar_registro_organizacion', {
        p_nombre_org: nombreOrg.trim(),
      })

      if (rpcError) {
        setError(mensajeErrorBd(rpcError))
        return
      }

      await refreshProfile()
      navigate('/', { replace: true })
    } catch (err) {
      setError(mensajeErrorBd(err, 'Error al crear la organización'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
            <span className="text-white text-xl font-semibold">HF</span>
          </div>
          <h1 className="text-xl text-foreground font-semibold">Un paso más</h1>
          <p className="text-sm text-muted-foreground text-center">
            Nombra tu organización para empezar a usar M.A.D.Y.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground block font-semibold">
              Nombre de tu organización
            </label>
            <input
              type="text"
              value={nombreOrg}
              onChange={(e) => setNombreOrg(e.target.value)}
              placeholder="Ej: Rancho El Solar o tu nombre"
              required
              autoFocus
              autoComplete="organization"
              className="w-full h-12 px-4 rounded-lg border border-border-control bg-input-background
                focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground pt-1">
              Nombre de tu empresa, o tu nombre si trabajas por tu cuenta.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-agro-danger-fill text-agro-danger-text text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !nombreOrg.trim()}
            className="w-full h-14 bg-primary text-white rounded-3xl hover:bg-agro-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {submitting ? 'Creando organización…' : 'Continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}
