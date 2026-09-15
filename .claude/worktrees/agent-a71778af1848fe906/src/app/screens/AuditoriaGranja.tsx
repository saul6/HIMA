import { Sprout } from 'lucide-react'
import { AuditoriaScreen } from '@/app/components/auditoria/AuditoriaScreen'
import { PortadaGranjaForm } from '@/app/components/auditoria/PortadaGranjaForm'
import type { PortadaGranja } from '@/types/database.types'

export function AuditoriaGranja() {
  return (
    <AuditoriaScreen
      modulo="m15"
      titulo="Auditoría Granja (M2 BPA)"
      clave="Buenas Prácticas Agrícolas · Por evento"
      icono={<Sprout className="w-5 h-5" />}
      renderPortada={({ portada, onChange }) => (
        <PortadaGranjaForm value={portada as PortadaGranja} onChange={onChange} />
      )}
    />
  )
}
