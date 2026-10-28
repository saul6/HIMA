import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { BottomSheet } from '@/app/components/BottomSheet'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { FilaRegistro } from '@/app/components/ui-mady/FilaRegistro'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { useConfirmar } from '@/app/components/ui-mady/ConfirmarSheet'
import { useAuthContext } from '@/context/AuthContext'
import { useConexion } from '@/hooks/useConexion'
import { nomina } from '@/hooks/useNomina'
import { hoyMX } from '@/lib/fecha'
import { avisarErrorNomina } from '@/lib/nomina/errores'
import { fechaCorta } from '@/lib/nomina/formato'
import { CampoTexto, CuerpoSheet } from './ui'
import type { OrgEstadoNomina } from '@/types/nomina.types'

function HabilitarSheet({ org, onClose, onGuardado }: { org: OrgEstadoNomina; onClose: () => void; onGuardado: () => Promise<void> }) {
  const [fecha, setFecha] = useState(org.fecha_arranque ?? hoyMX())
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    try {
      await nomina.habilitarOrg(org.org_id, fecha)
      toast.success('Módulo habilitado')
      await onGuardado()
      onClose()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo habilitar el módulo')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} height="85%" title={`Habilitar · ${org.nombre}`}>
      <CuerpoSheet textoGuardar="Habilitar" onGuardar={guardar} cargando={guardando} deshabilitado={!fecha}>
        <p className="text-sm text-muted-foreground">
          Se crea la configuración, los conceptos y el catálogo base (sin precios) y se activa el módulo.
        </p>
        <CampoTexto etiqueta="Fecha de arranque" tipo="date" valor={fecha} onChange={setFecha} requerido />
      </CuerpoSheet>
    </BottomSheet>
  )
}

/** Solo super_admin: habilita o deshabilita "Actividades y pagos" por organización. */
export function NominaOrgsAdmin() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()
  const { offline } = useConexion()
  const { confirmar, confirmarElemento } = useConfirmar()
  const [orgs, setOrgs] = useState<OrgEstadoNomina[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [habilitando, setHabilitando] = useState<OrgEstadoNomina | null>(null)
  const esSuper = profile?.rol === 'super_admin'

  const cargar = useCallback(async () => {
    try {
      setOrgs(await nomina.orgsEstado() ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { if (esSuper) void cargar() }, [esSuper, cargar])

  if (profile && !esSuper) return <Navigate to="/" replace />

  async function deshabilitar(o: OrgEstadoNomina) {
    if (!(await confirmar({
      titulo: `Deshabilitar · ${o.nombre}`,
      descripcion: 'Se oculta el módulo; los datos se conservan.',
      textoConfirmar: 'Deshabilitar',
      tono: 'peligro',
    }))) return
    try {
      await nomina.deshabilitarOrg(o.org_id)
      toast.success('Módulo deshabilitado')
      await cargar()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo deshabilitar el módulo')
    }
  }

  return (
    <div className="min-h-full pb-safe-nav">
      <ModuloHeader tituloFallback="Actividades y pagos" forzarTitulo="Actividades y pagos" subtitulo="Por organización" onBack={() => navigate('/perfil')} />
      <div className="px-4 py-4 space-y-4 max-w-3xl mx-auto">
        <TituloSeccion>Actividades y pagos por organización</TituloSeccion>
        {cargando && <p className="text-sm text-muted-foreground text-center py-6">Cargando…</p>}
        {error && (
          <div className="rounded-xl bg-agro-danger-fill text-agro-danger-text text-sm px-3 py-3 space-y-2">
            <p>{error}</p>
            <Boton tamano="sm" variante="secundario" onClick={() => void cargar()}>Reintentar</Boton>
          </div>
        )}
        {orgs.map(o => (
          <FilaRegistro
            key={o.org_id}
            variante="tarjeta"
            titulo={o.nombre}
            subtitulo={[o.plan, o.estado].filter(Boolean).join(' · ')}
            etiquetas={<Etiqueta tono={o.habilitado ? 'menta' : 'neutral'}>{o.habilitado ? 'Habilitado' : 'No habilitado'}</Etiqueta>}
            lineas={
              <span className="block">
                {o.trabajadores} trabajadores · {o.cortes} cortes
                {o.fecha_arranque && <> · arranque {fechaCorta(o.fecha_arranque)} {o.fecha_arranque.slice(0, 4)}</>}
              </span>
            }
            acciones={o.habilitado
              ? <Boton tamano="sm" variante="secundario" disabled={offline} onClick={() => void deshabilitar(o)}>Deshabilitar</Boton>
              : <Boton tamano="sm" disabled={offline} onClick={() => setHabilitando(o)}>Habilitar</Boton>}
          />
        ))}
      </div>
      {habilitando && <HabilitarSheet org={habilitando} onClose={() => setHabilitando(null)} onGuardado={cargar} />}
      {confirmarElemento}
    </div>
  )
}
