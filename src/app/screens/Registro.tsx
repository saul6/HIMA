import { useState, useRef, useEffect, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { Mail, Lock, User, Building2, Eye, EyeOff, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { AuthCarouselPanel } from '@/app/components/AuthCarouselPanel'
import { AuthMobileBanner } from '@/app/components/AuthMobileBanner'
import { AuthLeavesDecor } from '@/app/components/AuthLeavesDecor'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

export function Registro() {
  const { signUp } = useAuthContext()
  const navigate = useNavigate()

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombreOrg, setNombreOrg] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmacionPendiente, setConfirmacionPendiente] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)

  // Turnstile 'compact' en móvil (cabe en pantallas angostas), 'normal'
  // (acostado) en escritorio — una sola instancia, decidido por matchMedia.
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    if (SITE_KEY && !captchaToken) {
      setError('Completa la verificación antes de continuar')
      return
    }

    setSubmitting(true)
    const { error: signUpError, requiresConfirmation } = await signUp(
      email,
      password,
      nombre,
      captchaToken ?? undefined
    )
    setSubmitting(false)

    if (signUpError) {
      setError(signUpError)
      // El token ya fue usado (o falló) — pedir uno nuevo
      turnstileRef.current?.reset()
      setCaptchaToken(null)
      return
    }

    if (requiresConfirmation) {
      setConfirmacionPendiente(true)
      return
    }

    navigate('/completar-organizacion', { state: { nombreOrg } })
  }

  const iconCls = 'absolute left-3 top-1/2 -translate-y-1/2 w-[17px] h-[17px] pointer-events-none'
  const ctaCls = 'auth-cta w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:cursor-not-allowed'

  // ── Confirmación pendiente ────────────────────────────────────────────────

  if (confirmacionPendiente) {
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
          <div className="w-full max-w-[380px] space-y-6 text-center">
            <h1 className="text-[28px] lg:text-[34px] font-bold leading-tight [letter-spacing:-0.01em]" style={{ color: 'var(--auth-heading-color)' }}>
              Revisa tu correo
            </h1>
            <div
              className="p-4 rounded-xl space-y-2 text-left"
              style={{ background: 'var(--auth-success-fill)', color: 'var(--auth-success-text)' }}
            >
              <p style={{ fontWeight: 600 }}>Correo de confirmación enviado</p>
              <p className="text-sm">
                Enviamos un enlace a <strong>{email}</strong>. Haz clic en el enlace y después inicia sesión para completar tu registro.
              </p>
            </div>
            <Link
              to="/login"
              className="block text-sm text-center font-semibold"
              style={{ color: 'var(--secondary)' }}
            >
              Ir a iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulario de registro ────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row min-h-screen" style={{ background: 'var(--background)' }}>

      {/* ── Banner móvil (Opción B), solo <lg ── */}
      <div className="lg:hidden">
        <AuthMobileBanner paused={!!focusedField} />
      </div>

      {/* ── PANEL IZQUIERDO: carrusel de fotos (solo lg+, 60%) ── */}
      <AuthCarouselPanel className="hidden lg:flex lg:w-[60%]" />

      {/* ── PANEL: formulario (100% en móvil, 40% en escritorio) ── */}
      <div
        className="auth-panel relative flex-1 lg:w-[40%] flex flex-col items-center justify-center p-6 lg:items-center lg:justify-start lg:pt-12 lg:pb-10 lg:px-12 transition-colors duration-150"
        style={{ background: 'var(--auth-panel-bg)' }}
      >
        <AuthLeavesDecor />

        {/* Nav superior — misma posición que en Login */}
        <div className="absolute top-6 right-6 lg:top-8 lg:right-10 text-sm">
          <span style={{ color: 'var(--auth-subtext-color)' }}>¿Ya tienes cuenta? </span>
          <Link to="/login" style={{ color: 'var(--secondary)', fontWeight: 600 }}>
            Inicia sesión
          </Link>
        </div>

        <div className="w-full max-w-[380px] space-y-6">
          <div className="space-y-1 mt-8 lg:mt-0">
            <h1
              className="text-[26px] lg:text-[34px] font-bold leading-tight [letter-spacing:-0.01em]"
              style={{ color: 'var(--auth-heading-color)' }}
            >
              Crear cuenta
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-[6px]">
              <label className="text-xs font-semibold block" style={{ color: 'var(--auth-label-color)' }}>
                Nombre completo
              </label>
              <div className="relative">
                <User className={iconCls} style={{ color: 'var(--auth-icon-color)' }} />
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onFocus={() => setFocusedField('nombre')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Juan Pérez García"
                  required
                  autoComplete="name"
                  className="w-full h-[42px] auth-input border pl-10 pr-4 text-sm focus:outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--auth-input-placeholder)]"
                  style={getInputStyle(focusedField === 'nombre')}
                />
              </div>
            </div>

            <div className="space-y-[6px]">
              <label className="text-xs font-semibold block" style={{ color: 'var(--auth-label-color)' }}>
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className={iconCls} style={{ color: 'var(--auth-icon-color)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="correo@ejemplo.com"
                  required
                  autoComplete="email"
                  className="w-full h-[42px] auth-input border pl-10 pr-9 text-sm focus:outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--auth-input-placeholder)]"
                  style={getInputStyle(focusedField === 'email')}
                />
                {EMAIL_RE.test(email) && (
                  <CheckCircle2
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: 'var(--secondary)' }}
                  />
                )}
              </div>
            </div>

            <div className="space-y-[6px]">
              <label className="text-xs font-semibold block" style={{ color: 'var(--auth-label-color)' }}>
                Contraseña
              </label>
              <div className="relative">
                <Lock className={iconCls} style={{ color: 'var(--auth-icon-color)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  autoComplete="new-password"
                  className="w-full h-[42px] auth-input border pl-10 pr-10 text-sm focus:outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--auth-input-placeholder)]"
                  style={getInputStyle(focusedField === 'password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded"
                  style={{ color: 'var(--auth-icon-color)' }}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword
                    ? <EyeOff className="w-[17px] h-[17px]" />
                    : <Eye className="w-[17px] h-[17px]" />}
                </button>
              </div>
            </div>

            <div className="space-y-[6px]">
              <label className="text-xs font-semibold block" style={{ color: 'var(--auth-label-color)' }}>
                Nombre de tu organización
              </label>
              <div className="relative">
                <Building2 className={iconCls} style={{ color: 'var(--auth-icon-color)' }} />
                <input
                  type="text"
                  value={nombreOrg}
                  onChange={(e) => setNombreOrg(e.target.value)}
                  onFocus={() => setFocusedField('nombreOrg')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Ej: Rancho El Solar o tu nombre"
                  required
                  autoComplete="organization"
                  className="w-full h-[42px] auth-input border pl-10 pr-4 text-sm focus:outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--auth-input-placeholder)]"
                  style={getInputStyle(focusedField === 'nombreOrg')}
                />
              </div>
              <p className="text-xs pt-1" style={{ color: 'var(--auth-subtext-color)' }}>
                (O tu nombre si eres independiente).
              </p>
            </div>

            {SITE_KEY && (
              <div
                className="flex flex-col items-stretch gap-2 p-3 rounded-[10px] border"
                style={{ borderColor: 'var(--auth-input-border)', background: 'var(--auth-input-bg)' }}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: 'var(--secondary)' }} />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--auth-label-color)' }}>
                      Verificación de seguridad
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--auth-subtext-color)' }}>
                      Completa el captcha para continuar
                    </p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={SITE_KEY}
                    options={{ theme: 'auto', size: isDesktop ? 'normal' : 'compact' }}
                    onSuccess={(token) => setCaptchaToken(token)}
                    onExpire={() => setCaptchaToken(null)}
                    onError={() => {
                      setCaptchaToken(null)
                      setError('Verificación fallida, intenta de nuevo')
                    }}
                  />
                </div>
              </div>
            )}

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
              disabled={submitting || (!!SITE_KEY && !captchaToken)}
              className={ctaCls}
              style={{ marginTop: '4px' }}
            >
              {submitting ? 'Creando cuenta…' : (<>Crear cuenta<ArrowRight className="w-4 h-4" /></>)}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
