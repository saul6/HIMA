import { Factory } from 'lucide-react'
import { AuditoriaScreen } from '@/app/components/auditoria/AuditoriaScreen'
import { PortadaBPMForm } from '@/app/components/auditoria/PortadaBPMForm'
import type { PortadaBPM } from '@/types/database.types'

export function AuditoriaBPM() {
  return (
    <AuditoriaScreen
      modulo="m17"
      titulo="BPM's (M5 PrimusGFS)"
      clave="Buenas Prácticas de Manufactura · Por evento"
      icono={<Factory className="w-5 h-5" />}
      renderPortada={({ portada, onChange }) => (
        <PortadaBPMForm value={(portada as PortadaBPM) ?? {}} onChange={onChange} />
      )}
    />
  )
}
