import { Users } from 'lucide-react'
import { AuditoriaScreen } from '@/app/components/auditoria/AuditoriaScreen'
import { PortadaCosechaForm } from '@/app/components/auditoria/PortadaCosechaForm'
import type { PortadaCosecha } from '@/types/database.types'

export function AuditoriaCosecha() {
  return (
    <AuditoriaScreen
      modulo="m16"
      titulo="Auditoría Cuadrilla (M4 BPA)"
      clave="Cuadrilla de Cosecha · Por evento"
      icono={<Users className="w-5 h-5" />}
      renderPortada={({ portada, onChange }) => (
        <PortadaCosechaForm value={portada as PortadaCosecha} onChange={onChange} />
      )}
    />
  )
}
