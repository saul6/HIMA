// Ícono del botón de mostrar/ocultar contraseña en las pantallas de auth: los
// dos íconos conviven apilados y se cruzan con fundido y escala (ver
// .auth-eye-icon en theme.css) en vez de cambiar de golpe.
import { Eye, EyeOff } from 'lucide-react'

export function AuthEyeToggle({ shown }: { shown: boolean }) {
  return (
    <span className="relative block w-[17px] h-[17px]" aria-hidden="true">
      <Eye className="auth-eye-icon absolute top-0 left-0 w-full h-full" data-on={!shown} />
      <EyeOff className="auth-eye-icon absolute top-0 left-0 w-full h-full" data-on={shown} />
    </span>
  )
}
