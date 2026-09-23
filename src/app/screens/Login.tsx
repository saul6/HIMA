import { useState, useRef, useEffect, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { AuthCarouselPanel } from '@/app/components/AuthCarouselPanel'
import { AuthMobileBackdrop } from '@/app/components/AuthMobileBackdrop'
import { AuthLeavesDecor } from '@/app/components/AuthLeavesDecor'
import { LoginTransition } from '@/app/components/LoginTransition'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getInputStyle(focused: boolean): React.CSSProperties {
  return {
    background: 'var(--auth-input-bg)',
    borderColor: focused ? 'var(--auth-accent)' : 'var(--auth-input-border)',
    boxShadow: focused
      ? '0 0 0 3px color-mix(in srgb, var(--auth-accent) 18%, transparent)'
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
  const [showIntro, setShowIntro] = useState(false)
  const navigatedRef = useRef(false)

  // Turnstile 'flexible' (100% ancho, min 300x65) mantiene la forma acostada
  // también en móvil — 'compact' (150x140) se ve casi cuadrado, lo cual no
  // queremos. 'normal' (300x65) es fijo y es lo que se usa en el panel ancho
  // de escritorio. Una sola instancia del widget — se decide por matchMedia,
  // nunca duplicando el montaje.
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const [modoRecup, setModoRecup] = useState(false)
  const [recupEmail, setRecupEmail] = useState('')
  const [recupEnviado, setRecupEnviado] = useState(false)
  const [recupCargando, setRecupCargando] = useState(false)
  const [recupError, setRecupError] = useState<string | null>(null)

  function goToApp() {
    if (navigatedRef.current) return
    navigatedRef.current = true
    navigate(returnTo, { replace: true })
  }

  useEffect(() => {
    if (loading || !user) return
    // Sesión ya existente (ej. visita directa a /login estando logueado) —
    // sin animación de bienvenida, solo cuando viene de un submit real.
    if (!submitting) { goToApp(); return }
    setShowIntro(true)
    // Red de seguridad: si LoginTransition no llamara a onDone por algún
    // motivo, igual se entra a la app — el login nunca queda condicionado
    // a que la animación termine.
    const fallback = setTimeout(goToApp, 2600)
    return () => clearTimeout(fallback)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, submitting])

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--auth-navy-dark)' }}>
        <div className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>Cargando...</div>
      </div>
    )
  }

  const iconCls = 'absolute left-3 top-1/2 -translate-y-1/2 w-[17px] h-[17px] pointer-events-none'
  const ctaCls = 'auth-cta w-full h-12 font-semibold flex items-center justify-center gap-2 disabled:cursor-not-allowed'

  return (
    <div className="relative flex flex-col lg:flex-row min-h-screen lg:h-screen lg:overflow-hidden justify-center lg:justify-end lg:items-center" style={{ background: 'var(--background)' }}>

      {showIntro && <LoginTransition onDone={goToApp} />}

      {/* ── Fondo móvil: carrusel a pantalla completa + logo arriba-izquierda, solo <lg ── */}
      <div className="lg:hidden">
        <AuthMobileBackdrop paused={!!focusedField} />
      </div>

      {/* ── Escritorio: carrusel a pantalla completa detrás de la tarjeta ── */}
      <AuthCarouselPanel className="hidden lg:flex lg:absolute lg:inset-0 lg:w-full lg:z-0" />

      {/* ── PANEL: tarjeta glass flotante — móvil centrada, escritorio flotando a la derecha ── */}
      <div
        className="auth-panel relative z-10 w-[calc(100%-2rem)] max-w-[400px] mx-auto lg:mx-0 lg:mr-8 lg:w-[38%] lg:min-w-[420px] lg:max-w-[560px] flex flex-col items-center justify-center rounded-2xl border backdrop-blur-xl p-5 lg:p-10 transition-colors duration-150"
        style={{ background: 'var(--auth-panel-bg)', borderColor: 'var(--auth-border-dark)' }}
      >
        <AuthLeavesDecor />

        <div className="w-full max-w-[380px] space-y-7">

          {/* Título + subtítulo — cambia según login / recuperar acceso */}
          <div className="space-y-1">
            {modoRecup ? (
              <>
                <h1
                  className="text-[22px] leading-tight font-semibold lg:text-[34px] lg:font-bold lg:whitespace-nowrap lg:[letter-spacing:-0.01em]"
                  style={{ color: 'var(--auth-heading-color)' }}
                >
                  Recupera tu acceso
                </h1>
                <p className="text-sm" style={{ color: 'var(--auth-subtext-color)' }}>
                  Ingresa tu correo y te enviaremos un enlace para restablecerla.
                </p>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

          {/* ── Recuperación de contraseña ── */}
          {modoRecup && (
            <div className="space-y-4">
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
                    ← Volver a iniciar sesión
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRecuperar} className="space-y-4">
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
                        className="w-full h-12 lg:h-[42px] auth-input border pl-10 pr-4 text-sm focus:outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--auth-input-placeholder)]"
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
                    style={{ borderRadius: 10, color: 'var(--auth-cta-text)' }}
                  >
                    {recupCargando ? 'Enviando…' : 'Enviar enlace de recuperación'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setModoRecup(false); setRecupError(null) }}
                    className="w-full text-sm"
                    style={{ color: 'var(--auth-subtext-color)' }}
                  >
                    ← Volver a iniciar sesión
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
                  className="w-full h-12 lg:h-[42px] auth-input border pl-10 pr-9 text-sm focus:outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--auth-input-placeholder)]"
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
                  className="w-full h-12 lg:h-[42px] auth-input border pl-10 pr-10 text-sm focus:outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--auth-input-placeholder)]"
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
                // -mx-5 cancela el padding horizontal de la tarjeta (p-5=20px)
                // en móvil: Turnstile tiene un mínimo duro de ~300px que no
                // cabía en teléfonos angostos (S21/iPhone 11) con ese padding
                // acumulado. lg:mx-0 lo restaura en escritorio, donde el panel
                // siempre tiene sobra de ancho.
                className="flex flex-col items-stretch gap-2 p-2 lg:p-3 rounded-[10px] border bg-[var(--auth-input-bg)] -mx-5 lg:mx-0"
                style={{ borderColor: 'var(--auth-input-border)' }}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: 'var(--auth-accent)' }} />
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
                    options={{ theme: 'auto', size: isDesktop ? 'normal' : 'flexible' }}
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

            {/* Botón CTA — sky con degradado, texto navy, mismo en todos los breakpoints */}
            <button
              type="submit"
              disabled={submitting || (!!SITE_KEY && !captchaToken)}
              className={ctaCls}
              style={{ borderRadius: 10, color: 'var(--auth-cta-text)' }}
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

            {/* Línea de confianza — solo escritorio */}
            <p className="hidden lg:flex items-center justify-center gap-1.5 text-xs pt-1 lg:pt-6" style={{ color: 'var(--auth-link-color)' }}>
              <Lock className="w-3 h-3" />
              Tu información está protegida
            </p>
          </form>}
        </div>
      </div>
    </div>
  )
}
