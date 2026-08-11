import { useState, useRef, useEffect, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { MadyLogo } from '@/app/components/MadyLogo'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

const SLIDES = [
  {
    src: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1400&q=80',
    caption: 'Inocuidad digital, lista para auditoría PrimusGFS',
  },
  {
    src: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1400&q=80',
    caption: 'Trazabilidad completa del campo a la empacadora',
  },
  {
    src: 'https://images.unsplash.com/photo-1500651230702-0e2d8a49d4e9?auto=format&fit=crop&w=1400&q=80',
    caption: 'Registros en tiempo real. Formatos PDF listos para el auditor',
  },
]

function getInputStyle(focused: boolean): React.CSSProperties {
  return {
    background: 'var(--input-background)',
    borderColor: focused ? 'var(--secondary)' : 'var(--border)',
    boxShadow: focused
      ? '0 0 0 3px color-mix(in srgb, var(--secondary) 18%, transparent)'
      : 'none',
    color: 'var(--foreground)',
    borderRadius: 10,
  }
}

export function Login() {
  const { user, loading, signIn } = useAuthContext()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)
  const [active, setActive] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true })
  }, [user, loading, navigate])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (reducedMotion) return
    const t = setInterval(() => setActive(p => (p + 1) % SLIDES.length), 3500)
    return () => clearInterval(t)
  }, [reducedMotion])

  useEffect(() => {
    SLIDES.forEach(({ src }) => { const img = new Image(); img.src = src })
  }, [])

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
      turnstileRef.current?.reset()
      setCaptchaToken(null)
    } else {
      navigate('/', { replace: true })
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

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>

      {/* ── PANEL IZQUIERDO: carrusel de fotos (solo lg+) ── */}
      <div
        className="hidden lg:flex lg:w-[55%] relative flex-col overflow-hidden"
        style={{ background: 'var(--primary)' }}
      >
        {SLIDES.map((slide, i) => (
          <div
            key={slide.src}
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${slide.src})`,
              opacity: i === active ? 1 : 0,
              transition: reducedMotion ? 'none' : 'opacity 1s ease-in-out',
            }}
          />
        ))}

        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.12) 45%, rgba(0,0,0,0.68) 100%)',
          }}
        />

        <div className="relative flex flex-col justify-between h-full p-10 z-10">
          <div>
            <MadyLogo theme="dark" style={{ height: 38, width: 'auto' }} />
            <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 400 }}>
              Inocuidad Alimentaria Digital
            </p>
          </div>

          <div className="pb-2">
            <div className="relative" style={{ minHeight: '5.5rem' }}>
              {SLIDES.map((slide, i) => (
                <p
                  key={i}
                  className="absolute inset-x-0 top-0 text-white text-xl font-semibold leading-snug"
                  style={{
                    opacity: i === active ? 1 : 0,
                    transition: reducedMotion ? 'none' : 'opacity 0.6s ease-in-out',
                    maxWidth: 440,
                    pointerEvents: i === active ? 'auto' : 'none',
                  }}
                >
                  {slide.caption}
                </p>
              ))}
            </div>

            {/* Dots discretos — círculos uniformes, sin pill ni verde */}
            <div className="flex items-center gap-[6px] mt-4">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => setActive(i)}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: i === active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.35)',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: reducedMotion ? 'none' : 'background 0.3s ease',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── PANEL DERECHO: formulario (surface claro) ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-6 lg:p-14 min-h-screen"
        style={{ background: 'var(--background)' }}
      >
        <div className="w-full max-w-[380px] space-y-7">

          {/* Logo M.A.D.Y + tagline */}
          <div className="space-y-[3px]">
            <MadyLogo theme="light" style={{ height: 36, width: 'auto' }} />
            <p
              className="text-[10px] tracking-widest uppercase"
              style={{ color: 'var(--muted-foreground)', letterSpacing: '0.1em' }}
            >
              Inocuidad Digital
            </p>
          </div>

          {/* Título + subtítulo */}
          <div className="space-y-1">
            <h1
              className="text-[22px] leading-tight"
              style={{ fontWeight: 600, color: 'var(--primary)' }}
            >
              Bienvenido de nuevo
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Accede a tu cuenta para continuar
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Correo */}
            <div className="space-y-[6px]">
              <label className="text-xs font-semibold block" style={{ color: 'var(--primary)' }}>
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className={iconCls} style={{ color: 'var(--muted-foreground)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="correo@ejemplo.com"
                  required
                  autoComplete="email"
                  className="w-full h-12 border pl-10 pr-4 text-sm focus:outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--muted-foreground)]"
                  style={getInputStyle(focusedField === 'email')}
                />
              </div>
            </div>

            {/* Contraseña */}
            <div className="space-y-[6px]">
              <label className="text-xs font-semibold block" style={{ color: 'var(--primary)' }}>
                Contraseña
              </label>
              <div className="relative">
                <Lock className={iconCls} style={{ color: 'var(--muted-foreground)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full h-12 border pl-10 pr-10 text-sm focus:outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--muted-foreground)]"
                  style={getInputStyle(focusedField === 'password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded"
                  style={{ color: 'var(--muted-foreground)' }}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword
                    ? <EyeOff className="w-[17px] h-[17px]" />
                    : <Eye className="w-[17px] h-[17px]" />}
                </button>
              </div>
              <div className="flex justify-end pt-[1px]">
                <span className="text-xs cursor-pointer" style={{ color: 'var(--muted-foreground)' }}>
                  ¿Olvidaste tu contraseña?
                </span>
              </div>
            </div>

            {/* Turnstile con icono de verificación */}
            {SITE_KEY && (
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: 'var(--secondary)' }} />
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

            {/* Botón navy con flecha */}
            <button
              type="submit"
              disabled={submitting || (!!SITE_KEY && !captchaToken)}
              className="w-full h-12 text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'var(--primary)',
                borderRadius: 10,
              }}
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
          </form>

          <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
            ¿No tienes cuenta?{' '}
            <Link
              to="/registro"
              className="font-semibold"
              style={{ color: 'var(--secondary)' }}
            >
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
