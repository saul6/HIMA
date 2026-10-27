import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { FileDown, Receipt } from 'lucide-react'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { Boton } from '@/app/components/ui-mady/Boton'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { FilaRegistro } from '@/app/components/ui-mady/FilaRegistro'
import { useConfirmar } from '@/app/components/ui-mady/ConfirmarSheet'
import { useConexion } from '@/hooks/useConexion'
import { nomina, useMisVouchers } from '@/hooks/useNomina'
import { avisarErrorNomina } from '@/lib/nomina/errores'
import { formatoMoneda, rangoSemana } from '@/lib/nomina/formato'
import { generarVoucherPDF } from '@/lib/pdf/m81/generarVoucherPDF'
import { estadoPagoEtiqueta } from './CorteTab'
import { declaracionVoucher, useErrorFirma } from './FirmasVoucher'

/** Vouchers aprobados del trabajador ligado al usuario. No da acceso a nada más del módulo. */
export function MisVouchers() {
  const navigate = useNavigate()
  const { offline } = useConexion()
  const { datos, cargando, error, recargar } = useMisVouchers()
  const [generando, setGenerando] = useState<string | null>(null)
  const [firmando, setFirmando] = useState<string | null>(null)
  const { confirmar, confirmarElemento } = useConfirmar()
  const alErrorFirma = useErrorFirma(recargar)
  const eventId = useRef<{ clave: string; id: string } | null>(null)

  async function firmar(corteId: string) {
    setFirmando(corteId)
    try {
      // Se pide el voucher vigente: la firma es sobre la revisión que se ve en ese momento.
      const v = await nomina.voucher(corteId)
      if (v.firmas?.recibio) {
        toast.success('Ya firmaste este voucher')
        await recargar()
        return
      }
      const ok = await confirmar({
        titulo: 'Firmar de recibido',
        descripcion: declaracionVoucher(v),
        textoConfirmar: 'Firmar',
      })
      if (!ok) return
      const clave = `${corteId}-${v.revision}`
      if (eventId.current?.clave !== clave) eventId.current = { clave, id: crypto.randomUUID() }
      const r = await nomina.firmarVoucher({ corte: corteId, rol: 'recibio', revision: v.revision, eventId: eventId.current.id })
      eventId.current = null
      toast.success(r.repetida ? 'Ya estaba firmado' : 'Firma registrada')
      await recargar()
    } catch (e) {
      await alErrorFirma(e)
    } finally {
      setFirmando(null)
    }
  }

  async function descargar(corteId: string) {
    setGenerando(corteId)
    try {
      await generarVoucherPDF(corteId)
      await recargar()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo generar el voucher')
    } finally {
      setGenerando(null)
    }
  }

  return (
    <div className="min-h-full pb-safe-nav">
      <ModuloHeader tituloFallback="Mis vouchers" forzarTitulo="Mis vouchers" onBack={() => navigate('/perfil')} />
      <div className="px-4 py-4 space-y-3 max-w-3xl mx-auto">
        {error && (
          <div className="rounded-xl bg-agro-danger-fill text-agro-danger-text text-sm px-3 py-3 space-y-2">
            <p>{error}</p>
            <Boton tamano="sm" variante="secundario" onClick={() => void recargar()}>Reintentar</Boton>
          </div>
        )}
        {!error && !cargando && datos.length === 0 && (
          <EstadoVacio icono={Receipt} titulo="Aún no tienes vouchers" ayuda="Aquí aparecerán tus pagos semanales aprobados." />
        )}
        {datos.map(v => {
          const est = estadoPagoEtiqueta(v.pago)
          return (
            <FilaRegistro
              key={v.corte_id}
              variante="tarjeta"
              titulo={rangoSemana(v.inicio)}
              subtitulo={v.folio}
              etiquetas={
                <>
                  <Etiqueta tono={est.tono}>{est.texto}</Etiqueta>
                  <Etiqueta tono={v.firmado_recibio ? 'menta' : 'neutral'}>{v.firmado_recibio ? 'Firmado' : 'Falta tu firma'}</Etiqueta>
                </>
              }
              lineas={
                <>
                  Neto {formatoMoneda(v.neto)}
                  {v.pago.pendiente > 0 && <> · Pendiente {formatoMoneda(v.pago.pendiente)}</>}
                </>
              }
              acciones={
                <>
                  {!v.firmado_recibio && (
                    <Boton tamano="sm" cargando={firmando === v.corte_id} disabled={offline} onClick={() => void firmar(v.corte_id)}>
                      Firmar de recibido
                    </Boton>
                  )}
                  <Boton tamano="sm" variante="secundario" cargando={generando === v.corte_id} disabled={offline} onClick={() => void descargar(v.corte_id)}>
                    <FileDown className="size-4" /> PDF
                  </Boton>
                </>
              }
            />
          )
        })}
      </div>
      {confirmarElemento}
    </div>
  )
}
