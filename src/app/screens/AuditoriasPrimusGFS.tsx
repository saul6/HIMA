import { Navigate, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { ClipboardCheck } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { useAuditoriasPGFS } from '@/hooks/useAuditoriasPGFS'
import type { AuditoriaListItem } from '@/hooks/useAuditoriasPGFS'
import { LEYENDA_LEGAL_PGFS } from '@/lib/auditoriasPGFS'
import { Fab } from '@/app/components/Fab'
import { EncabezadoPantalla } from '@/app/components/EncabezadoPantalla'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { useMostrarCarga } from '@/hooks/useMostrarCarga'
import { ListaTarjetas } from '@/app/components/ui-mady/ListaTarjetas'
import { TarjetaRegistro } from '@/app/components/ui-mady/TarjetaRegistro'
import { Etiqueta, type TonoEtiqueta } from '@/app/components/ui-mady/Etiqueta'
import { Aviso } from '@/app/components/checklist/comun'
import { useEntradaPantalla } from '@/lib/motion'

const ROLES_PERMITIDOS = ['auditor', 'admin_org', 'super_admin']

const ESTADO_LABELS: Record<string, string> = {
  en_proceso: 'En proceso',
  completada: 'Completada',
  cerrada: 'Cerrada',
}

const ESTADO_TONO: Record<string, TonoEtiqueta> = {
  en_proceso: 'sky',
  completada: 'menta',
  cerrada: 'neutral',
}

function formatFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

function AuditoriaCard({ a, onClick }: { a: AuditoriaListItem; onClick: () => void }) {
  return (
    <TarjetaRegistro
      sinFirmas
      meta={[`${a.rancho_nombre} · ${formatFecha(a.fecha)}`]}
      titulo={a.modulo_nombre}
      tituloTexto={a.modulo_nombre}
      alHacerClic={onClick}
      chips={(
        <>
          <Etiqueta tono={ESTADO_TONO[a.estado] ?? 'neutral'}>{ESTADO_LABELS[a.estado] ?? a.estado}</Etiqueta>
          {a.auditor_nombre && (
            <Etiqueta tono="neutral" className="font-normal">Auditor: {a.auditor_nombre}</Etiqueta>
          )}
        </>
      )}
    />
  )
}

export default function AuditoriasPrimusGFS() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()
  const { auditorias, loading, error, refetch } = useAuditoriasPGFS()
  const mostrarSkeleton = useMostrarCarga(loading, auditorias.length > 0)
  const ent = useEntradaPantalla(!loading)

  if (!ROLES_PERMITIDOS.includes(profile?.rol ?? '')) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      <EncabezadoPantalla titulo="Auditorías" subtitulo="v3.2" alRegresar={() => navigate(-1)} />

      {/* Resumen (escritorio; en celular la versión va como subtítulo del encabezado) */}
      <p className="hidden px-4 pt-4 text-right text-xs text-muted-foreground md:block">
        v3.2{!loading && !error ? ` · ${auditorias.length} ${auditorias.length === 1 ? 'auditoría' : 'auditorías'}` : ''}
      </p>

      {/* Leyenda legal */}
      <div className="mx-4 mt-4 md:mt-2">
        <Aviso>{LEYENDA_LEGAL_PGFS}</Aviso>
      </div>

      <main className="flex-1 px-4 py-4 flex flex-col gap-3">
        {loading ? (
          mostrarSkeleton ? <ListaSkeleton rejilla onReintentar={refetch} /> : null
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <p className="text-sm text-center" style={{ color: 'var(--agro-danger-text)' }}>{error}</p>
            <button
              onClick={refetch}
              className="text-xs underline"
              style={{ color: 'var(--primary)' }}
            >
              Reintentar
            </button>
          </div>
        ) : auditorias.length === 0 ? (
          <EstadoVacio icono={ClipboardCheck} titulo="Sin auditorías registradas" ayuda="Usa el botón + para crear la primera" />
        ) : (
          <ListaTarjetas>
            {auditorias.map((a, index) => (
              <motion.div key={a.id} {...ent(index)}>
                <AuditoriaCard
                  a={a}
                  onClick={() => navigate(`/inocuidad/auditorias-primusgfs/${a.id}`)}
                />
              </motion.div>
            ))}
          </ListaTarjetas>
        )}
      </main>

      {/* FAB */}
            <Fab onClick={() => navigate('/inocuidad/auditorias-primusgfs/nueva')} aria-label="Nueva auditoría" />
    </div>
  )
}
