import { ClipboardCheck } from 'lucide-react'
import { AuditoriaScreen } from '@/app/components/auditoria/AuditoriaScreen'

export function AuditoriaSaia() {
  return (
    <AuditoriaScreen
      modulo="m14"
      titulo="Auditoría SAIA (M1)"
      clave="Sistema Administrativo de Inocuidad · Por evento"
      icono={<ClipboardCheck className="w-5 h-5" />}
    />
  )
}
