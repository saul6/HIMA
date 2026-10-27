import { useState } from 'react'
import { useNavigate } from 'react-router'
import { FileDown, Receipt } from 'lucide-react'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { Boton } from '@/app/components/ui-mady/Boton'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { FilaRegistro } from '@/app/components/ui-mady/FilaRegistro'
import { useConexion } from '@/hooks/useConexion'
import { useMisVouchers } from '@/hooks/useNomina'
import { avisarErrorNomina } from '@/lib/nomina/errores'
import { formatoMoneda, rangoSemana } from '@/lib/nomina/formato'
import { generarVoucherPDF } from '@/lib/pdf/m81/generarVoucherPDF'
import { estadoPagoEtiqueta } from './CorteTab'

/** Vouchers aprobados del trabajador ligado al usuario. No da acceso a nada más del módulo. */
export function MisVouchers() {
  const navigate = useNavigate()
  const { offline } = useConexion()
  const { datos, cargando, error, recargar } = useMisVouchers()
  const [generando, setGenerando] = useState<string | null>(null)

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
              etiquetas={<Etiqueta tono={est.tono}>{est.texto}</Etiqueta>}
              lineas={
                <>
                  Neto {formatoMoneda(v.neto)}
                  {v.pago.pendiente > 0 && <> · Pendiente {formatoMoneda(v.pago.pendiente)}</>}
                </>
              }
              acciones={
                <Boton tamano="sm" variante="secundario" cargando={generando === v.corte_id} disabled={offline} onClick={() => void descargar(v.corte_id)}>
                  <FileDown className="size-4" /> PDF
                </Boton>
              }
            />
          )
        })}
      </div>
    </div>
  )
}
