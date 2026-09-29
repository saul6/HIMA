// Paso de registro de firma personal antes de abrir el formulario.
// Se muestra cuando obligatoria=true y el usuario no tiene firma guardada.
// Llama a mi_firma_guardar y notifica al padre cuando se guarda.

import { useRef, useState } from 'react'
import { Loader2, PenLine } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { FirmaPad, type FirmaPadRef } from '@/app/components/FirmaPad'
import { useFirmaContext } from '@/context/FirmaContext'

interface FirmaGatePasoProps {
  onFirmaGuardada: () => void
}

export function FirmaGatePaso({ onFirmaGuardada }: FirmaGatePasoProps) {
  const firmaPadRef = useRef<FirmaPadRef>(null)
  const [firmaPadInfo, setFirmaPadInfo] = useState({ vacia: true, puntos: 0 })
  const [guardando, setGuardando] = useState(false)
  const { refrescar } = useFirmaContext()

  async function handleGuardar() {
    if (!firmaPadRef.current) return
    const { png, trazos } = firmaPadRef.current.exportar()
    setGuardando(true)
    try {
      const eventId = crypto.randomUUID()
      const { error } = await (supabase as any).rpc('mi_firma_guardar', {
        p_firma_png: png,
        p_trazos: trazos,
        p_event_id: eventId,
      })
      if (error) throw error
      toast.success('Firma registrada')
      await refrescar()
      onFirmaGuardada()
    } catch {
      toast.error('No se pudo guardar la firma')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'var(--primary)', opacity: 0.1 }}>
          <PenLine className="w-5 h-5" style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Registra tu firma para continuar
          </p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Tu organización requiere firma en todos los formatos.
          </p>
        </div>
      </div>

      <FirmaPad
        ref={firmaPadRef}
        onChange={(info) => setFirmaPadInfo(info)}
      />

      <button
        onClick={handleGuardar}
        disabled={guardando || firmaPadInfo.puntos < 15}
        className="w-full h-14 rounded-3xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors hover:bg-agro-blue"
        style={{ backgroundColor: 'var(--primary)', color: 'white' }}
      >
        {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
        Guardar mi firma y continuar
      </button>
    </div>
  )
}
