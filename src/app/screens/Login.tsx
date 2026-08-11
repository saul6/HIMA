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

  // Precarga imágenes
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
        <div className="text-white/70 text-sm">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>

      {/* ── PANEL IZQUIERDO: marca + carrusel (solo lg+) ── */}
      <div
        className="hidden lg:flex lg:w-[55%] relative flex-col overflow-hidden"
        style={{ background: 'var(--primary)' }}
      >
        {/* Imágenes del carrusel */}
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

        {/* Overlay degradado: oscuro arriba y abajo, translúcido en el centro */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0.65) 100%)',
          }}
        />

        {/* Contenido sobre el carrusel */}
        <div className="relative flex flex-col justify-between h-full p-10 z-10">

          {/* Logo + subtítulo (arriba) */}
          <div>
            <MadyLogo theme="dark" style={{ height: 38, width: 'auto' }} />
            <p
              className="text-sm mt-2"
              style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 400 }}
            >
              Inocuidad Alimentaria Digital
            </p>
          </div>

          {/* Caption + puntos indicadores (abajo) */}
          <div className="pb-2">
            {/* Captions superpuestos con fade */}
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

            {/* Dots */}
            <div className="flex items-center gap-2 mt-4">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => setActive(i)}
                  style={{
                    width: i === active ? 24 : 8,
                    height: 8,
                    borderRadius: 4,
                    background: i === active ? 'var(--secondary)' : 'rgba(255,255,255,0.38)',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    transition: reducedMotion ? 'none' : 'width 0.3s ease, background 0.3s ease',
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
        style={{ background: 'var(--background)' }}
      >
        {/* Franja de marca en móvil (solo < lg) */}
        <div className="lg:hidden mb-8 flex flex-col items-center gap-1">
          <MadyLogo theme="light" style={{ height: 34, width: 'auto' }} />
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Inocuidad Alimentaria
          </p>
        </div>

        <div className="w-full max-w-[360px] space-y-6">
          {/* Encabezado */}
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              Iniciar sesión
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Accede a tu cuenta M.A.D.Y
            </p>
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
                  color: 'var(--foreground)',
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
                  color: 'var(--foreground)',
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
            <Link to="/registro" style={{ color: 'var(--secondary)', fontWeight: 600 }}>
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
