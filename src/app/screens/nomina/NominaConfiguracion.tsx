import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { Boton } from '@/app/components/ui-mady/Boton'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { nomina, useNomConfigVer } from '@/hooks/useNomina'
import { useConexion } from '@/hooks/useConexion'
import { avisarErrorNomina } from '@/lib/nomina/errores'
import { fechaCorta } from '@/lib/nomina/formato'
import { CampoTexto } from './ui'

const fechaLarga = (f: string) => `${fechaCorta(f)} ${f.slice(0, 4)}`

function FilaLectura({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between text-sm py-2 border-b border-border last:border-b-0">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="font-semibold tabular-nums">{valor}</span>
    </div>
  )
}

export function NominaConfiguracion() {
  const navigate = useNavigate()
  const { offline } = useConexion()
  const { datos: cfg, cargando, error, recargar } = useNomConfigVer()
  const [arranque, setArranque] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { if (cfg) setArranque(cfg.fecha_arranque) }, [cfg])

  const cambio = !!cfg && !!arranque && arranque !== cfg.fecha_arranque
  const pasaDeCaptura = !!cfg?.primera_captura && arranque > cfg.primera_captura

  async function guardar() {
    setGuardando(true)
    try {
      await nomina.guardarConfig(arranque)
      toast.success('Fecha de arranque actualizada')
      await recargar()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo guardar la configuración')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="min-h-full pb-safe-nav">
      <ModuloHeader tituloFallback="Configuración" forzarTitulo="Configuración" onBack={() => navigate('/nomina')} />
      <div className="px-4 py-4 space-y-6 max-w-3xl mx-auto">
        {cargando && !cfg && <p className="text-sm text-muted-foreground text-center py-6">Cargando…</p>}
        {error && !cfg && (
          <div className="rounded-xl bg-agro-danger-fill text-agro-danger-text text-sm px-3 py-3 space-y-2">
            <p>{error}</p>
            <Boton tamano="sm" variante="secundario" onClick={() => void recargar()}>Reintentar</Boton>
          </div>
        )}
        {cfg && (
          <>
            <section className="space-y-3">
              <TituloSeccion>Fecha de arranque</TituloSeccion>
              <CampoTexto
                etiqueta="Primer día del módulo"
                tipo="date"
                valor={arranque}
                onChange={setArranque}
                max={cfg.primera_captura ?? undefined}
                requerido
                error={pasaDeCaptura ? 'No puede ser posterior a la primera captura' : undefined}
                ayuda={cfg.primera_captura
                  ? `Ya hay capturas desde el ${fechaLarga(cfg.primera_captura)}: no puede ser posterior.`
                  : 'Aún no hay capturas: puedes moverla libremente.'}
              />
              <Boton className="w-full" cargando={guardando} disabled={offline || !cambio || pasaDeCaptura} onClick={() => void guardar()}>
                Guardar
              </Boton>
            </section>

            <section>
              <TituloSeccion>General</TituloSeccion>
              <div className="rounded-xl border border-border bg-card px-4">
                <FilaLectura etiqueta="Zona horaria" valor={cfg.zona_horaria} />
                <FilaLectura etiqueta="Moneda" valor={cfg.moneda} />
                <FilaLectura etiqueta="La semana va de" valor="Lunes a domingo" />
                <FilaLectura etiqueta="Siguiente folio" valor={`NOM-${String(cfg.folio_siguiente).padStart(6, '0')}`} />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
