import { ShieldCheck } from 'lucide-react'
import { AuditoriaScreen } from '@/app/components/auditoria/AuditoriaScreen'

export function AuditoriaHACCP() {
  return (
    <AuditoriaScreen
      modulo="m18"
      titulo="HACCP (M6 PrimusGFS)"
      clave="Requisitos del Sistema HACCP · Por evento"
      icono={<ShieldCheck className="w-5 h-5" />}
    />
  )
}
