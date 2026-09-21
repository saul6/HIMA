import { useState, useRef, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { Mail, Lock, User, Building2, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { AuthBackground } from '@/app/components/AuthBackground'
import { AuthCarouselPanel } from '@/app/components/AuthCarouselPanel'
import { MadyLogo } from '@/app/components/MadyLogo'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

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
      <>
        {/* Móvil — sin cambios */}
        <div className="lg:hidden">
          <AuthBackground>
            <div
              className="w-full max-w-[360px] bg-white rounded-2xl p-7 space-y-6 text-center"
              style={{ boxShadow: '0 4px 32px rgba(0,0,0,0.18)' }}
            >
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'var(--primary)' }}
                >
                  <span className="text-white text-xl" style={{ fontWeight: 700, letterSpacing: '-0.5px' }}>AC</span>
                </div>
                <h1 className="text-[19px]" style={{ fontWeight: 700 }}><MadyLogo theme="light" /></h1>
              </div>
              <div
                className="p-4 rounded-xl space-y-2"
                style={{ background: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
              >
                <p style={{ fontWeight: 600 }}>Revisa tu correo</p>
                <p className="text-sm">
                  Enviamos un enlace de confirmación a <strong>{email}</strong>.
                  Haz clic en el enlace y después inicia sesión para completar tu registro.
                </p>
              </div>
              <Link
                to="/login"
                className="block text-sm text-center"
                style={{ color: 'var(--primary)', fontWeight: 600 }}
              >
                Ir a iniciar sesión
              </Link>
            </div>
          </AuthBackground>
        </div>

        {/* Escritorio — panel oscuro con paleta M.A.D.Y */}
        <div className="hidden lg:flex min-h-screen" style={{ background: 'var(--background)' }}>
          <AuthCarouselPanel className="flex lg:w-[65%]" />
          <div
            className="auth-panel flex-1 lg:w-[35%] flex flex-col items-center justify-center p-12 min-h-screen"
            style={{ background: 'var(--auth-panel-bg)' }}
          >
            <div className="w-full max-w-[380px] space-y-6 text-center">
              <h1 className="text-[34px] font-bold leading-tight [letter-spacing:-0.01em]" style={{ color: 'var(--auth-heading-color)' }}>
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
      </>
    )
  }

  // ── Formulario de registro ────────────────────────────────────────────────

  return (
    <>
      {/* Móvil — sin cambios */}
      <div className="lg:hidden">
        <AuthBackground>
          <div
            className="w-full max-w-[360px] bg-white rounded-2xl p-7 space-y-6"
            style={{ boxShadow: '0 4px 32px rgba(0,0,0,0.18)' }}
          >
            {/* Logo */}
            <div className="flex flex-col items-center gap-2 pb-1">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--primary)' }}
              >
                <span className="text-white text-xl" style={{ fontWeight: 700, letterSpacing: '-0.5px' }}>AC</span>
              </div>
              <h1 className="text-[19px]" style={{ fontWeight: 700 }}>Crear cuenta</h1>
              <p className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                <MadyLogo theme="light" /> · Inocuidad Alimentaria
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs block" style={{ fontWeight: 600, color: 'var(--muted-foreground)' }}>
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Juan Pérez García"
                  required
                  autoComplete="name"
                  className="w-full h-12 px-4 rounded-lg border focus:outline-none focus:ring-1"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--input-background)',
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs block" style={{ fontWeight: 600, color: 'var(--muted-foreground)' }}>
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  required
                  autoComplete="email"
                  className="w-full h-12 px-4 rounded-lg border focus:outline-none focus:ring-1"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--input-background)',
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs block" style={{ fontWeight: 600, color: 'var(--muted-foreground)' }}>
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  autoComplete="new-password"
                  className="w-full h-12 px-4 rounded-lg border focus:outline-none focus:ring-1"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--input-background)',
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs block" style={{ fontWeight: 600, color: 'var(--muted-foreground)' }}>
                  Nombre de tu organización
                </label>
                <input
                  type="text"
                  value={nombreOrg}
                  onChange={(e) => setNombreOrg(e.target.value)}
                  placeholder="Ej: Rancho El Solar o tu nombre"
                  required
                  autoComplete="organization"
                  className="w-full h-12 px-4 rounded-lg border focus:outline-none focus:ring-1"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--input-background)',
                  }}
                />
                <p className="text-xs pt-1" style={{ color: 'var(--muted-foreground)' }}>
                  Nombre de tu empresa, o tu nombre si trabajas por tu cuenta.
                </p>
              </div>

              {/* Turnstile CAPTCHA */}
              {SITE_KEY && (
                <div className="flex justify-center">
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={SITE_KEY}
                    options={{ theme: 'light', size: 'normal' }}
                    onSuccess={(token) => setCaptchaToken(token)}
                    onExpire={() => setCaptchaToken(null)}
                    onError={() => {
                      setCaptchaToken(null)
                      setError('Verificación fallida, intenta de nuevo')
                    }}
                  />
                </div>
              )}

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
                disabled={submitting || (!!SITE_KEY && !captchaToken)}
                className="w-full h-12 rounded-xl text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--primary)', fontWeight: 600, marginTop: '4px' }}
              >
                {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
              </button>
            </form>

            <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                Iniciar sesión
              </Link>
            </p>
          </div>
        </AuthBackground>
      </div>

      {/* Escritorio — carrusel 2/3 + panel oscuro con paleta M.A.D.Y 1/3 */}
      <div className="hidden lg:flex min-h-screen" style={{ background: 'var(--background)' }}>
        <AuthCarouselPanel className="flex lg:w-[65%]" />

        <div
          className="auth-panel flex-1 lg:w-[35%] flex flex-col items-center justify-center p-12 min-h-screen transition-colors duration-150"
          style={{ background: 'var(--auth-panel-bg)' }}
        >
          <div className="w-full max-w-[380px] space-y-6">
            <div className="space-y-1">
              <h1
                className="text-[38px] font-bold leading-tight [letter-spacing:-0.01em]"
                style={{ color: 'var(--auth-heading-color)' }}
              >
                Crear cuenta
              </h1>
              <p className="text-sm" style={{ color: 'var(--auth-subtext-color)' }}>
                Regístrate para empezar a usar M.A.D.Y
              </p>
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
                    className="w-full h-12 border pl-10 pr-4 text-sm focus:outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--auth-input-placeholder)]"
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
                    className="w-full h-12 border pl-10 pr-4 text-sm focus:outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--auth-input-placeholder)]"
                    style={getInputStyle(focusedField === 'email')}
                  />
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
                    className="w-full h-12 border pl-10 pr-4 text-sm focus:outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--auth-input-placeholder)]"
                    style={getInputStyle(focusedField === 'nombreOrg')}
                  />
                </div>
                <p className="text-xs pt-1" style={{ color: 'var(--auth-subtext-color)' }}>
                  Nombre de tu empresa, o tu nombre si trabajas por tu cuenta.
                </p>
              </div>

              {SITE_KEY && (
                <div
                  className="flex items-center justify-center p-3 rounded-[10px] border"
                  style={{ borderColor: 'var(--auth-input-border)' }}
                >
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

            <p className="text-sm text-center" style={{ color: 'var(--auth-subtext-color)' }}>
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" style={{ color: 'var(--secondary)', fontWeight: 600 }}>
                Iniciar sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
