import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Lock, Eye, EyeOff, CheckCircle2, ArrowRight, AlertCircle } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { AuthCarouselPanel } from '@/app/components/AuthCarouselPanel'
import { AuthMobileBanner } from '@/app/components/AuthMobileBanner'
import { AuthLeavesDecor } from '@/app/components/AuthLeavesDecor'

function getInputStyle(focused: boolean): React.CSSProperties {
  return {
    background: 'var(--auth-input-bg)',
    borderColor: focused ? 'var(--secondary)' : 'var(--auth-input-border)',
    boxShadow: focused
      ? '0 0 0 3px color-mix(in srgb, var(--secondary) 18%, transparent)'
      : 'none',
    color: 'var(--auth-input-text)',
    borderRadius: 10,
  }
}

interface StatusPanelProps {
  iconBg: string
  icon: React.ReactNode
  title: string
  titleSizeLg: string
  message: string
  ctaLabel: string
  onCta: () => void
}

function StatusPanel({ iconBg, icon, title, titleSizeLg, message, ctaLabel, onCta }: StatusPanelProps) {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="lg:hidden">
        <AuthMobileBanner />
      </div>
      <AuthCarouselPanel className="hidden lg:flex lg:w-[60%]" />
      <div
        className="auth-panel relative flex-1 lg:w-[40%] flex flex-col items-center justify-center p-6 lg:p-12"
        style={{ background: 'var(--auth-panel-bg)' }}
      >
        <AuthLeavesDecor />
        <div className="w-full max-w-[380px] flex flex-col items-center gap-6 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: iconBg }}
          >
            {icon}
          </div>
          <div className="space-y-2">
            <h1 className={`text-[26px] ${titleSizeLg} font-bold [letter-spacing:-0.01em]`} style={{ color: 'var(--auth-heading-color)' }}>
              {title}
            </h1>
            <p className="text-sm" style={{ color: 'var(--auth-subtext-color)' }}>
              {message}
            </p>
          </div>
          <button
            onClick={onCta}
            className="auth-cta w-full h-12 text-white font-semibold flex items-center justify-center gap-2"
            style={{ borderRadius: 10 }}
          >
            {ctaLabel}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
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
  const ctaCls = 'auth-cta w-full h-12 text-white font-semibold flex items-center justify-center gap-2'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Cargando...</div>
      </div>
    )
  }

  if (success) {
    return (
      <StatusPanel
        iconBg="var(--auth-success-fill)"
        icon={<CheckCircle2 className="w-8 h-8" style={{ color: 'var(--auth-success-text)' }} />}
        title="¡Contraseña actualizada!"
        titleSizeLg="lg:text-[32px]"
        message="Tu contraseña se actualizó correctamente. Inicia sesión con tu nueva contraseña."
        ctaLabel="Ir al inicio de sesión"
        onCta={() => navigate('/login', { replace: true })}
      />
    )
  }

  if (tokenExpirado) {
    return (
      <StatusPanel
        iconBg="var(--auth-warning-fill)"
        icon={<AlertCircle className="w-8 h-8" style={{ color: 'var(--auth-warning-text)' }} />}
        title="El enlace ha vencido"
        titleSizeLg="lg:text-[30px]"
        message="El enlace de recuperación ya no es válido. Solicita uno nuevo desde el inicio de sesión."
        ctaLabel="Volver al inicio de sesión"
        onCta={() => navigate('/login', { replace: true })}
      />
    )
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen" style={{ background: 'var(--background)' }}>

      {/* ── Banner móvil (Opción B), solo <lg ── */}
      <div className="lg:hidden">
        <AuthMobileBanner paused={!!focusedField} />
      </div>

      <AuthCarouselPanel className="hidden lg:flex lg:w-[60%]" />

      <div
        className="auth-panel relative flex-1 lg:w-[40%] flex flex-col items-center justify-center p-6 lg:justify-start lg:pt-20 lg:pb-12 lg:px-12 transition-colors duration-150"
        style={{ background: 'var(--auth-panel-bg)' }}
      >
        <AuthLeavesDecor />
        <div className="w-full max-w-[380px] space-y-7 lg:space-y-8">

          <div className="space-y-1">
            <h1
              className="text-[26px] lg:text-[38px] font-bold leading-tight [letter-spacing:-0.01em]"
              style={{ color: 'var(--auth-heading-color)' }}
            >
              Nueva contraseña
            </h1>
            <p className="text-sm" style={{ color: 'var(--auth-subtext-color)' }}>
              Elige una contraseña segura para tu cuenta.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-5" style={{ marginTop: 'var(--auth-form-gap-top)' }}>

            <div className="space-y-[6px]">
              <label className="text-xs font-semibold block" style={{ color: 'var(--auth-label-color)' }}>
                Nueva contraseña
              </label>
              <div className="relative">
                <Lock className={iconCls} style={{ color: 'var(--auth-icon-color)' }} />
                <input
                  type={showNueva ? 'text' : 'password'}
                  value={nueva}
                  onChange={(e) => setNueva(e.target.value)}
                  onFocus={() => setFocusedField('nueva')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  autoComplete="new-password"
                  className="w-full h-12 lg:h-[42px] auth-input border pl-10 pr-10 text-sm focus:outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--auth-input-placeholder)]"
                  style={getInputStyle(focusedField === 'nueva')}
                />
                <button
                  type="button"
                  onClick={() => setShowNueva(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded"
                  style={{ color: 'var(--auth-icon-color)' }}
                  aria-label={showNueva ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showNueva
                    ? <EyeOff className="w-[17px] h-[17px]" />
                    : <Eye className="w-[17px] h-[17px]" />}
                </button>
              </div>
            </div>

            <div className="space-y-[6px]">
              <label className="text-xs font-semibold block" style={{ color: 'var(--auth-label-color)' }}>
                Confirmar contraseña
              </label>
              <div className="relative">
                <Lock className={iconCls} style={{ color: 'var(--auth-icon-color)' }} />
                <input
                  type={showConfirmar ? 'text' : 'password'}
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  onFocus={() => setFocusedField('confirmar')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Repite tu nueva contraseña"
                  required
                  autoComplete="new-password"
                  className="w-full h-12 lg:h-[42px] auth-input border pl-10 pr-10 text-sm focus:outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--auth-input-placeholder)]"
                  style={getInputStyle(focusedField === 'confirmar')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmar(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded"
                  style={{ color: 'var(--auth-icon-color)' }}
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
                style={{ background: 'var(--auth-danger-fill)', color: 'var(--auth-danger-text)' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={ctaCls}
              style={{ borderRadius: 10 }}
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
    </div>
  )
}
