import { useState, useRef, useEffect, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
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

export function Login() {
  const { user, loading, signIn } = useAuthContext()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--primary)' }}>

      {/* ── PANEL IZQUIERDO: carrusel (solo lg+) ── */}
      <div
        className="hidden lg:flex lg:w-[55%] relative flex-col overflow-hidden"
        style={{ background: 'var(--primary)' }}
      >
        {/* Imágenes */}
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

        {/* Overlay degradado oscuro arriba y abajo */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.12) 45%, rgba(0,0,0,0.68) 100%)',
          }}
        />

        {/* Contenido sobre las fotos */}
        <div className="relative flex flex-col justify-between h-full p-10 z-10">

          {/* Logo arriba */}
          <div>
            <MadyLogo theme="dark" style={{ height: 38, width: 'auto' }} />
            <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 400 }}>
              Inocuidad Alimentaria Digital
            </p>
          </div>

          {/* Caption + dots (abajo) */}
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

            {/* Dots: círculos discretos, sin pill ni verde */}
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

      {/* ── PANEL DERECHO: formulario ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-6 lg:p-14 min-h-screen"
        style={{ background: 'var(--primary)' }}
      >
        <div className="w-full max-w-[360px]">

          {/* Logo M.A.D.Y encima del formulario (visible en todos los breakpoints) */}
          <div className="flex flex-col items-start gap-1 mb-8">
            <MadyLogo theme="dark" style={{ height: 34, width: 'auto' }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Inocuidad Alimentaria
            </p>
          </div>

          {/* Tarjeta del formulario con elevación sutil */}
          <div
            className="rounded-2xl p-7 space-y-6"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {/* Encabezado */}
            <div className="space-y-1">
              <h1 className="text-[22px] font-bold" style={{ color: 'rgba(255,255,255,0.96)' }}>
                Iniciar sesión
              </h1>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Accede a tu cuenta M.A.D.Y
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label
                  className="text-xs block"
                  style={{ fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}
                >
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  required
                  autoComplete="email"
                  className="w-full h-12 px-4 rounded-lg border focus:outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/35"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    borderColor: 'rgba(255,255,255,0.14)',
                    color: 'rgba(255,255,255,0.92)',
                  }}
                />
              </div>

              <div className="space-y-1">
                <label
                  className="text-xs block"
                  style={{ fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}
                >
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full h-12 px-4 rounded-lg border focus:outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/35"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    borderColor: 'rgba(255,255,255,0.14)',
                    color: 'rgba(255,255,255,0.92)',
                  }}
                />
              </div>

              {/* Turnstile CAPTCHA */}
              {SITE_KEY && (
                <div className="flex justify-center">
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={SITE_KEY}
                    options={{ theme: 'dark', size: 'normal' }}
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
                className="w-full h-12 rounded-xl text-white font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--secondary)', marginTop: '4px' }}
              >
                {submitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </button>
            </form>

            <p className="text-sm text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>
              ¿No tienes cuenta?{' '}
              <Link to="/registro" style={{ color: 'var(--secondary)', fontWeight: 600 }}>
                Regístrate
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
