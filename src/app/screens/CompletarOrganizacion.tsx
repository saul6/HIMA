import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { useAuthContext } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { MadyLogo } from '@/app/components/MadyLogo'
import { supabase } from '@/lib/supabase'
import { mensajeErrorBd } from '@/lib/erroresBd'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Campo } from '@/app/components/ui-mady/Campo'

export function CompletarOrganizacion() {
  const { profile, refreshProfile } = useAuthContext()
  const navigate = useNavigate()
  const { resolvedTheme } = useTheme()
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
          <MadyLogo theme={resolvedTheme} className="h-16 w-auto" />
          <h1 className="text-xl text-foreground font-semibold">Un paso más</h1>
          <p className="text-sm text-muted-foreground text-center">
            Nombra tu organización para empezar a usar M.A.D.Y.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Campo
            etiqueta="Nombre de tu organización"
            ayuda="Nombre de tu empresa, o tu nombre si trabajas por tu cuenta."
            className="gap-1"
          >
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
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
            )}
          </Campo>

          {error && (
            <div className="p-3 rounded-lg bg-agro-danger-fill text-agro-danger-text text-sm">
              {error}
            </div>
          )}

          <Boton type="submit" className="w-full" disabled={submitting || !nombreOrg.trim()}>
            {submitting ? 'Creando organización…' : 'Continuar'}
          </Boton>
        </form>
      </div>
    </div>
  )
}
