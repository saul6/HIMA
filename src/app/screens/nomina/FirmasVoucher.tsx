import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { useConfirmar } from '@/app/components/ui-mady/ConfirmarSheet'
import { BottomSheet } from '@/app/components/BottomSheet'
import { FirmaPad, type FirmaPadRef } from '@/app/components/FirmaPad'
import { useAuthContext } from '@/context/AuthContext'
import { useConexion } from '@/hooks/useConexion'
import { nomina } from '@/hooks/useNomina'
import { avisarErrorNomina } from '@/lib/nomina/errores'
import { formatoMoneda } from '@/lib/nomina/formato'
import { fechaHora } from '@/lib/formato'
import type { FirmaVoucher, VoucherData } from '@/types/nomina.types'
import { CuerpoSheet } from './ui'

/** Texto que ve quien firma: lo que está confirmando. */
export function declaracionVoucher(v: VoucherData): string {
  return (
    `Folio ${v.folio} · revisión R${v.revision}. Neto ${formatoMoneda(v.totales.neto, v.moneda)}, ` +
    `entregado ${formatoMoneda(v.pago.entregado, v.moneda)}, pendiente ${formatoMoneda(v.pago.pendiente, v.moneda)}.`
  )
}

/** Errores de firma: sin firma registrada lleva al perfil; revisión vieja pide recargar. */
export function useErrorFirma(recargar: () => Promise<void>) {
  const navigate = useNavigate()
  return useCallback(async (e: unknown) => {
    const codigo = avisarErrorNomina(e, 'No se pudo firmar el voucher')
    if (codigo === 'FIRMA_NO_REGISTRADA') {
      toast.warning('Primero registra tu firma en tu perfil', {
        duration: 8000,
        action: { label: 'Ir a mi perfil', onClick: () => navigate('/perfil') },
      })
    } else if (codigo === 'VOUCHER_DESACTUALIZADO' || codigo === 'VOUCHER_YA_FIRMADO') {
      await recargar()
    }
  }, [navigate, recargar])
}

function FirmaHecha({ titulo, f }: { titulo: string; f: FirmaVoucher }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{titulo}</p>
        <Etiqueta tono="menta">Firmado</Etiqueta>
      </div>
      {f.firma_png && <img src={f.firma_png} alt={`Firma de ${f.firmante}`} className="h-10 object-contain" />}
      <p className="text-xs text-muted-foreground">
        {f.firmante} · {fechaHora(f.firmado_en)}
        {f.metodo === 'dispositivo' ? ' · capturada en dispositivo' : ''}
      </p>
    </div>
  )
}

/** Lienzo para capturar la firma del trabajador en el dispositivo del administrador. */
function FirmaDispositivoSheet({ voucher, corteId, onClose, onFirmado, onError }: {
  voucher: VoucherData
  corteId: string
  onClose: () => void
  onFirmado: () => Promise<void>
  onError: (e: unknown) => Promise<void>
}) {
  const padRef = useRef<FirmaPadRef>(null)
  const [info, setInfo] = useState({ vacia: true, puntos: 0 })
  const [guardando, setGuardando] = useState(false)
  const eventId = useRef(crypto.randomUUID())

  async function guardar() {
    if (!padRef.current) return
    const { png, trazos } = padRef.current.exportar()
    setGuardando(true)
    try {
      await nomina.firmarVoucherDispositivo({ corte: corteId, revision: voucher.revision, png, trazos, eventId: eventId.current })
      toast.success(`Firma de ${voucher.trabajador.nombre} registrada`)
      await onFirmado()
      onClose()
    } catch (e) {
      await onError(e)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} height="85%" title="Firma de recibido">
      <CuerpoSheet textoGuardar="Guardar firma" cargando={guardando} deshabilitado={info.puntos < 15} onGuardar={guardar}>
        <p className="text-sm text-muted-foreground">
          {voucher.trabajador.nombre} firma de recibido. {declaracionVoucher(voucher)}
        </p>
        <FirmaPad ref={padRef} onChange={setInfo} />
        <Boton variante="secundario" tamano="sm" onClick={() => padRef.current?.limpiar()}>Borrar</Boton>
      </CuerpoSheet>
    </BottomSheet>
  )
}

/** Firmas del voucher de un corte aprobado: Entregó (admin) y Recibí (trabajador o en dispositivo). */
export function FirmasVoucher({ corteId, claveRecarga, onVoucher }: { corteId: string; claveRecarga: string; onVoucher?: (v: VoucherData) => void }) {
  const { offline } = useConexion()
  const { profile } = useAuthContext()
  const esAdmin = profile?.rol === 'admin_org' || profile?.rol === 'super_admin'
  const { confirmar, confirmarElemento } = useConfirmar()
  const [voucher, setVoucher] = useState<VoucherData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [firmando, setFirmando] = useState(false)
  const [lienzo, setLienzo] = useState(false)
  const eventId = useRef<{ revision: number; id: string } | null>(null)

  const cargar = useCallback(async () => {
    try {
      const v = await nomina.voucher(corteId)
      setVoucher(v)
      onVoucher?.(v)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las firmas')
    }
  }, [corteId, onVoucher])

  useEffect(() => { void cargar() }, [cargar, claveRecarga])

  const alError = useErrorFirma(cargar)

  async function firmarEntrego(v: VoucherData) {
    const ok = await confirmar({
      titulo: 'Firmar como Entregó',
      descripcion: declaracionVoucher(v),
      textoConfirmar: 'Firmar',
    })
    if (!ok) return
    if (eventId.current?.revision !== v.revision) eventId.current = { revision: v.revision, id: crypto.randomUUID() }
    setFirmando(true)
    try {
      const r = await nomina.firmarVoucher({ corte: corteId, rol: 'entrego', revision: v.revision, eventId: eventId.current.id })
      eventId.current = null
      toast.success(r.repetida ? 'Ya estaba firmado' : 'Firma registrada')
      await cargar()
    } catch (e) {
      await alError(e)
    } finally {
      setFirmando(false)
    }
  }

  if (error && !voucher) {
    return (
      <section className="space-y-2">
        <TituloSeccion>Firmas del voucher</TituloSeccion>
        <p className="text-sm text-agro-danger-text">{error}</p>
        <Boton tamano="sm" variante="secundario" onClick={() => void cargar()}>Reintentar</Boton>
      </section>
    )
  }
  if (!voucher) return null

  const entrego = voucher.firmas?.entrego ?? null
  const recibio = voucher.firmas?.recibio ?? null
  const faltaAlguna = !entrego || !recibio

  return (
    <section className="space-y-2">
      <TituloSeccion className="mb-0">Firmas del voucher · R{voucher.revision}</TituloSeccion>

      {voucher.revision > 1 && faltaAlguna && (
        <div className="rounded-xl border border-agro-menta bg-agro-info-fill text-agro-info-text p-3 text-sm">
          Hubo un pago después de la revisión anterior; firma la revisión R{voucher.revision}. Las firmas viejas se conservan en su revisión.
        </div>
      )}

      {entrego
        ? <FirmaHecha titulo="Entregó" f={entrego} />
        : (
          <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Entregó</p>
            {voucher.puede_firmar_entrego
              ? <Boton tamano="sm" cargando={firmando} disabled={offline} onClick={() => void firmarEntrego(voucher)}>Firmar como Entregó</Boton>
              : <Etiqueta tono="neutral">Falta firma</Etiqueta>}
          </div>
        )}

      {recibio
        ? <FirmaHecha titulo="Recibí" f={recibio} />
        : (
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Recibí · {voucher.trabajador.nombre}</p>
              <Etiqueta tono="neutral">Falta firma</Etiqueta>
            </div>
            <p className="text-xs text-muted-foreground">
              Si el trabajador tiene usuario, puede firmar desde «Mis vouchers». Si está presente, captura su firma aquí.
            </p>
            {esAdmin && (
              <Boton tamano="sm" variante="secundario" disabled={offline} onClick={() => setLienzo(true)}>
                Firmar aquí (en este dispositivo)
              </Boton>
            )}
          </div>
        )}

      {lienzo && (
        <FirmaDispositivoSheet
          voucher={voucher}
          corteId={corteId}
          onClose={() => setLienzo(false)}
          onFirmado={cargar}
          onError={alError}
        />
      )}
      {confirmarElemento}
    </section>
  )
}
