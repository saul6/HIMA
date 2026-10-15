// Solo desarrollo: repite la intro de bienvenida sobre la app ya cargada al
// abrir cualquier pantalla con el parámetro `intro` en la URL. Se monta desde
// Layout dentro de `import.meta.env.DEV`, así Vite lo elimina del build de
// producción. Puramente visual: no toca sesión, captcha ni redirecciones.
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useIntroTransition } from '@/context/IntroTransitionContext'

export function IntroDevReplay() {
  if (!import.meta.env.DEV) return null
  const [params, setParams] = useSearchParams()
  const { start, markAppReady } = useIntroTransition()

  useEffect(() => {
    if (params.get('intro') !== '1') return
    start()
    // La app ya está montada debajo (Layout no vuelve a montar).
    markAppReady()
    const resto = new URLSearchParams(params)
    resto.delete('intro')
    setParams(resto, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
