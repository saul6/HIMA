import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Lock, Eye, EyeOff, CheckCircle2, ArrowRight, AlertCircle } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { MadyLogo } from '@/app/components/MadyLogo'

function getInputStyle(focused: boolean): React.CSSProperties {
  return {
    background: 'var(--input-background)',
    borderColor: focused ? 'var(--primary)' : 'var(--border)',
    boxShadow: focused
      ? '0 0 0 3px color-mix(in srgb, var(--primary) 16%, transparent)'
      : 'none',
    color: 'var(--foreground)',
    borderRadius: 10,
  }
}

export function RestablecerContrasena() {
  const { user, loading, isRecovery, clearRecovery, signOut } = useAuthContext()
  const navigate = useNavigate()

  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showNueva, setShowNueva] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [tokenExpirado, setTokenExpirado] = useState(false)

  useEffect(() => {
    if (loading || success) return
    if (!user || !isRecovery) {
      navigate('/login', { replace: true })
    }
  }, [user, loading, isRecovery, success, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (nueva.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (nueva !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }

    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: nueva })
    setSubmitting(false)

    if (updateError) {
      if (
        updateError.message.toLowerCase().includes('expired') ||
        updateError.message.toLowerCase().includes('invalid') ||
        updateError.message.toLowerCase().includes('jwt')
      ) {
        setTokenExpirado(true)
      } else {
        setError('No se pudo actualizar la contraseña. Intenta de nuevo.')
      }
      return
    }

    clearRecovery()
    setSuccess(true)
    await signOut()
  }

  const iconCls = 'absolute left-3 top-1/2 -translate-y-1/2 w-[17px] h-[17px] pointer-events-none'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Cargando...</div>
      </div>
    )
  }

  // Estado: éxito
  if (success) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: 'var(--background)' }}
      >
        <div className="w-full max-w-[380px] flex flex-col items-center gap-6 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'var(--agro-success-fill)' }}
          >
            <CheckCircle2 className="w-8 h-8" style={{ color: 'var(--agro-success-text)' }} />
          </div>
          <div className="space-y-2">
            <h1 className="text-[22px] font-semibold" style={{ color: 'var(--primary)' }}>
              ¡Contraseña actualizada!
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Tu contraseña se actualizó correctamente. Inicia sesión con tu nueva contraseña.
            </p>
          </div>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full h-12 text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:opacity-80 transition-opacity"
            style={{ background: 'var(--primary)', borderRadius: 10 }}
          >
            Ir al inicio de sesión
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // Estado: token vencido o inválido
  if (tokenExpirado) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: 'var(--background)' }}
      >
        <div className="w-full max-w-[380px] flex flex-col items-center gap-6 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'var(--agro-warning-fill)' }}
          >
            <AlertCircle className="w-8 h-8" style={{ color: 'var(--agro-warning-text)' }} />
          </div>
          <div className="space-y-2">
            <h1 className="text-[20px] font-semibold" style={{ color: 'var(--foreground)' }}>
              El enlace ha vencido
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              El enlace de recuperación ya no es válido. Solicita uno nuevo desde el inicio de sesión.
            </p>
          </div>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full h-12 text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:opacity-80 transition-opacity"
            style={{ background: 'var(--primary)', borderRadius: 10 }}
          >
            Volver al inicio de sesión
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 lg:p-14"
      style={{ background: 'var(--background)' }}
    >
      <div className="w-full max-w-[380px] space-y-7">

        <div className="space-y-[3px]">
          <MadyLogo theme="light" style={{ height: 36, width: 'auto' }} />
          <p
            className="text-[10px] tracking-widest uppercase"
            style={{ color: 'var(--muted-foreground)', letterSpacing: '0.1em' }}
          >
            Inocuidad Inteligente
          </p>
        </div>

        <div className="space-y-1">
          <h1
            className="text-[22px] leading-tight"
            style={{ fontWeight: 600, color: 'var(--primary)' }}
          >
            Nueva contraseña
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Elige una contraseña segura para tu cuenta.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Nueva contraseña */}
          <div className="space-y-[6px]">
            <label className="text-xs font-semibold block" style={{ color: 'var(--primary)' }}>
              Nueva contraseña
            </label>
            <div className="relative">
              <Lock className={iconCls} style={{ color: 'var(--muted-foreground)' }} />
              <input
                type={showNueva ? 'text' : 'password'}
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                onFocus={() => setFocusedField('nueva')}
                onBlur={() => setFocusedField(null)}
                placeholder="Mínimo 8 caracteres"
                required
                autoComplete="new-password"
                className="w-full h-12 border pl-10 pr-10 text-sm focus:outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--muted-foreground)]"
                style={getInputStyle(focusedField === 'nueva')}
              />
              <button
                type="button"
                onClick={() => setShowNueva(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded"
                style={{ color: 'var(--muted-foreground)' }}
                aria-label={showNueva ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showNueva
                  ? <EyeOff className="w-[17px] h-[17px]" />
                  : <Eye className="w-[17px] h-[17px]" />}
              </button>
            </div>
          </div>

          {/* Confirmar contraseña */}
          <div className="space-y-[6px]">
            <label className="text-xs font-semibold block" style={{ color: 'var(--primary)' }}>
              Confirmar contraseña
            </label>
            <div className="relative">
              <Lock className={iconCls} style={{ color: 'var(--muted-foreground)' }} />
              <input
                type={showConfirmar ? 'text' : 'password'}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                onFocus={() => setFocusedField('confirmar')}
                onBlur={() => setFocusedField(null)}
                placeholder="Repite tu nueva contraseña"
                required
                autoComplete="new-password"
                className="w-full h-12 border pl-10 pr-10 text-sm focus:outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--muted-foreground)]"
                style={getInputStyle(focusedField === 'confirmar')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmar(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded"
                style={{ color: 'var(--muted-foreground)' }}
                aria-label={showConfirmar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showConfirmar
                  ? <EyeOff className="w-[17px] h-[17px]" />
                  : <Eye className="w-[17px] h-[17px]" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{ background: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--primary)', borderRadius: 10 }}
          >
            {submitting ? (
              'Guardando...'
            ) : (
              <>
                Guardar nueva contraseña
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
