import { Link } from 'react-router'
import { TriangleAlert } from 'lucide-react'
import { useOutbox } from '@/hooks/useOutbox'
import { fechaHora } from '@/lib/formato'

const HORAS_AVISO = 48
const HORAS_VENTANA = 72

function fmt(d: Date): string {
  return fechaHora(d)
}

// Banner fijo cuando hay registros sin subir con más de 48 h: la ventana para subirlos es de 72 h.
export function AvisoVentana72h() {
  const { lotes } = useOutbox()
  const pendientes = lotes.filter((l) => l.estado === 'pendiente')
  if (pendientes.length === 0) return null
  const masViejo = pendientes.reduce((a, b) => (a.capturadoEn < b.capturadoEn ? a : b))
  const desde = new Date(masViejo.capturadoEn)
  if ((Date.now() - desde.getTime()) / 3_600_000 < HORAS_AVISO) return null
  const limite = new Date(desde.getTime() + HORAS_VENTANA * 3_600_000)

  return (
    <Link
      to="/sincronizacion"
      className="flex items-start gap-2 px-4 py-3"
      style={{ backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' }}
    >
      <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <p className="text-xs font-semibold">
        Tienes registros sin subir desde el {fmt(desde)}. Conéctate antes del {fmt(limite)} para no perderlos.
      </p>
    </Link>
  )
}
