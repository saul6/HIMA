import { useState, useRef, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { useAuthContext } from '@/context/AuthContext'
import { AuthBackground } from '@/app/components/AuthBackground'
import { MadyLogo } from '@/app/components/MadyLogo'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

export function Registro() {
  const { signUp } = useAuthContext()
  const navigate = useNavigate()

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombreOrg, setNombreOrg] = useState('')
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

  // ── Confirmación pendiente ────────────────────────────────────────────────

  if (confirmacionPendiente) {
    return (
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
    )
  }

  // ── Formulario de registro ────────────────────────────────────────────────

  return (
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
  )
}
