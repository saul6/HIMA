import { useState, useRef, useEffect, type FormEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { MadyLogo } from '@/app/components/MadyLogo'
import { AuthCarouselPanel } from '@/app/components/AuthCarouselPanel'
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

export function Login() {
  const { user, loading, signIn, requestPasswordReset } = useAuthContext()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = (() => { const r = searchParams.get('returnTo') ?? ''; return r.startsWith('/') ? r : '/' })()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)

  const [modoRecup, setModoRecup] = useState(false)
  const [recupEmail, setRecupEmail] = useState('')
  const [recupEnviado, setRecupEnviado] = useState(false)
  const [recupCargando, setRecupCargando] = useState(false)
  const [recupError, setRecupError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && user) navigate(returnTo, { replace: true })
  }, [user, loading, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (SITE_KEY && !captchaToken) {
      setError('Completa la verificación antes de continuar')
      return
    }
    setSubmitting(true)
    const result = await signIn(email, password, captchaToken ?? undefined)
    if (result.error) {
      setSubmitting(false)
      setError('Correo o contraseña incorrectos')
      turnstileRef.current?.reset()
      setCaptchaToken(null)
    }
    // En éxito: mantener submitting=true mientras el estado de auth actualiza;
    // el useEffect navega cuando user queda seteado.
  }

  async function handleRecuperar(e: FormEvent) {
    e.preventDefault()
    setRecupError(null)
    setRecupCargando(true)
    const result = await requestPasswordReset(recupEmail)
    setRecupCargando(false)
    if (result.error) {
      setRecupError('No pudimos enviar el correo. Verifica la dirección e intenta de nuevo.')
    } else {
      setRecupEnviado(true)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--primary)' }}>
        <div className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>Cargando...</div>
      </div>
    )
  }

  const iconCls = 'absolute left-3 top-1/2 -translate-y-1/2 w-[17px] h-[17px] pointer-events-none'
  const ctaCls = 'auth-cta w-full h-12 text-white font-semibold flex items-center justify-center gap-2 disabled:cursor-not-allowed'

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>

      {/* ── PANEL IZQUIERDO: carrusel de fotos (solo lg+, 60%) ── */}
      <AuthCarouselPanel className="hidden lg:flex lg:w-[60%]" />

      {/* ── PANEL DERECHO: formulario (40% en escritorio, verde oscuro derivado del mint) ── */}
      <div
        className="auth-panel relative flex-1 lg:w-[40%] flex flex-col items-center justify-center p-6 lg:p-12 min-h-screen transition-colors duration-150"
        style={{ background: 'var(--auth-panel-bg)' }}
      >
        <AuthLeavesDecor className="hidden lg:block" />

        {/* Nav superior — solo escritorio */}
        <div className="hidden lg:block absolute top-8 right-10 text-sm">
          <span style={{ color: 'var(--auth-subtext-color)' }}>¿Eres nuevo aquí? </span>
          <Link to="/registro" style={{ color: 'var(--secondary)', fontWeight: 600 }}>
            Regístrate
          </Link>
        </div>

        <div className="w-full max-w-[380px] space-y-7">

          {/* Logo M.A.D.Y + tagline — solo móvil, en escritorio ya está en el carrusel */}
          <div className="space-y-[3px] lg:hidden">
            <MadyLogo theme="light" style={{ height: 36, width: 'auto' }} />
            <p
              className="text-[10px] tracking-widest uppercase"
              style={{ color: 'var(--muted-foreground)', letterSpacing: '0.1em' }}
            >
              Inocuidad Inteligente
            </p>
          </div>

          {/* Título + subtítulo */}
          <div className="space-y-1">
            <h1
              className="text-[22px] leading-tight font-semibold lg:text-[34px] lg:font-bold lg:whitespace-nowrap lg:[letter-spacing:-0.01em]"
              style={{ color: 'var(--auth-heading-color)' }}
            >
              <span>Bienvenido </span>
              <span style={{ color: 'var(--auth-heading-accent-color)' }}>de nuevo</span>
            </h1>
            <p className="text-sm" style={{ color: 'var(--auth-subtext-color)' }}>
              Accede a tu cuenta para continuar
            </p>
          </div>

          {/* ── Recuperación de contraseña ── */}
          {modoRecup && (
            <div className="space-y-4" style={{ marginTop: 'var(--auth-form-gap-top)' }}>
              {recupEnviado ? (
                <div className="space-y-4">
                  <div
                    className="p-4 rounded-xl text-sm space-y-1"
                    style={{ background: 'var(--auth-success-fill)', color: 'var(--auth-success-text)' }}
                  >
                    <p style={{ fontWeight: 600 }}>Correo enviado</p>
                    <p>
                      Revisa tu bandeja de entrada en <strong>{recupEmail}</strong> y sigue el enlace para crear una nueva contraseña.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setModoRecup(false); setRecupEnviado(false); setRecupEmail('') }}
                    className="w-full text-sm"
                    style={{ color: 'var(--auth-link-color)', fontWeight: 600 }}
                  >
                    ← Volver al inicio de sesión
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRecuperar} className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm" style={{ color: 'var(--auth-subtext-color)' }}>
                      Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
                    </p>
                  </div>
                  <div className="space-y-[6px]">
                    <label className="text-xs font-semibold block" style={{ color: 'var(--auth-label-color)' }}>
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail className={iconCls} style={{ color: 'var(--auth-icon-color)' }} />
                      <input
                        type="email"
                        value={recupEmail}
                        onChange={e => setRecupEmail(e.target.value)}
                        onFocus={() => setFocusedField('recupEmail')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="correo@ejemplo.com"
                        required
                        autoComplete="email"
                        className="w-full h-12 border pl-10 pr-4 text-sm focus:outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--auth-input-placeholder)]"
                        style={getInputStyle(focusedField === 'recupEmail')}
                      />
                    </div>
                  </div>
                  {recupError && (
                    <div
                      className="p-3 rounded-lg text-sm"
                      style={{ background: 'var(--auth-danger-fill)', color: 'var(--auth-danger-text)' }}
                    >
                      {recupError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={recupCargando || !recupEmail}
                    className={ctaCls}
                    style={{ borderRadius: 10 }}
                  >
                    {recupCargando ? 'Enviando…' : 'Enviar enlace de recuperación'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setModoRecup(false); setRecupError(null) }}
                    className="w-full text-sm"
                    style={{ color: 'var(--auth-subtext-color)' }}
                  >
                    ← Volver al inicio de sesión
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Formulario de login */}
          {!modoRecup && <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-5" style={{ marginTop: 'var(--auth-form-gap-top)' }}>

            {/* Correo */}
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
                  className="w-full h-12 border pl-10 pr-4 lg:pr-9 text-sm focus:outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--auth-input-placeholder)]"
                  style={getInputStyle(focusedField === 'email')}
                />
                {EMAIL_RE.test(email) && (
                  <CheckCircle2
                    className="hidden lg:block absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: 'var(--secondary)' }}
                  />
                )}
              </div>
            </div>

            {/* Contraseña */}
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
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full h-12 border pl-10 pr-10 text-sm focus:outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--auth-input-placeholder)]"
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
              <div className="flex justify-end pt-[1px]">
                <button
                  type="button"
                  onClick={() => { setModoRecup(true); setRecupEmail(email); setRecupError(null) }}
                  className="text-xs"
                  style={{ color: 'var(--auth-link-color)', fontWeight: 500 }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </div>

            {/* Turnstile — fila simple en móvil, tarjeta con encabezado en escritorio */}
            {SITE_KEY && (
              <div
                className="flex items-center gap-3 lg:flex-col lg:items-stretch lg:gap-2 lg:p-3 lg:rounded-[10px] lg:border lg:bg-[var(--auth-input-bg)]"
                style={{ borderColor: 'var(--auth-input-border)' }}
              >
                <div className="flex items-center gap-3 lg:gap-2">
                  <ShieldCheck className="w-5 h-5 lg:w-4 lg:h-4 shrink-0" style={{ color: 'var(--secondary)' }} />
                  <div className="hidden lg:block">
                    <p className="text-xs font-semibold" style={{ color: 'var(--auth-label-color)' }}>
                      Verificación de seguridad
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--auth-subtext-color)' }}>
                      Completa el captcha para continuar
                    </p>
                  </div>
                </div>
                <div className="lg:flex lg:justify-center">
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={SITE_KEY}
                    options={{ theme: 'auto', size: 'normal' }}
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

            {/* Botón CTA — navy en móvil, mint en escritorio */}
            <button
              type="submit"
              disabled={submitting || (!!SITE_KEY && !captchaToken)}
              className={ctaCls}
              style={{ borderRadius: 10 }}
            >
              {submitting ? (
                'Iniciando sesión...'
              ) : (
                <>
                  Iniciar sesión
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Línea de confianza — solo escritorio (arriba ya está el nav de Regístrate) */}
            <p className="hidden lg:flex items-center justify-center gap-1.5 text-xs pt-1 lg:pt-6" style={{ color: 'var(--auth-link-color)' }}>
              <Lock className="w-3 h-3" />
              Tu información está protegida
            </p>
          </form>}

          {!modoRecup && (
            <p className="text-sm text-center lg:hidden" style={{ color: 'var(--auth-subtext-color)' }}>
              ¿No tienes cuenta?{' '}
              <Link
                to="/registro"
                className="font-semibold"
                style={{ color: 'var(--secondary)' }}
              >
                Regístrate
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
