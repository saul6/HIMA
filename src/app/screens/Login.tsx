import { useState, useRef, useEffect, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { useAuthContext } from '@/context/AuthContext'
import { AuthBackground } from '@/app/components/AuthBackground'
import { MadyLogo } from '@/app/components/MadyLogo'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

export function Login() {
  const { user, loading, signIn } = useAuthContext()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true })
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
    setSubmitting(false)

    if (result.error) {
      setError('Correo o contraseña incorrectos')
      // El token ya fue usado (o falló) — pedir uno nuevo
      turnstileRef.current?.reset()
      setCaptchaToken(null)
    } else {
      navigate('/', { replace: true })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D3A5C' }}>
        <div className="text-white/70 text-sm">Cargando...</div>
      </div>
    )
  }

  return (
    <AuthBackground>
      <div
        className="w-full max-w-[360px] bg-white rounded-2xl p-7 space-y-6"
        style={{ boxShadow: '0 4px 32px rgba(0,0,0,0.18)' }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 pb-1">
          <h1 className="text-[19px]" style={{ fontWeight: 700 }}><MadyLogo theme="light" /></h1>
          <p className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>Inocuidad Alimentaria</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full h-12 px-4 rounded-lg border focus:outline-none focus:ring-1"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--input-background)',
              }}
            />
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
            {submitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
          ¿No tienes cuenta?{' '}
          <Link to="/registro" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Regístrate
          </Link>
        </p>
      </div>
    </AuthBackground>
  )
}
