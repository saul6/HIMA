import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Campo } from '@/app/components/ui-mady/Campo'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

const inputSt: React.CSSProperties = {
  width: '100%', height: '2.5rem',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--input-background)',
  color: 'var(--foreground)',
  padding: '0 0.75rem',
  fontSize: '0.875rem',
}

export function NuevaInstalacionForm({ onClose }: { onClose: () => void }) {
  const { profile } = useAuthContext()
  const navigate = useNavigate()

  const [nombre, setNombre] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [cultivoProducto, setCultivoProducto] = useState('')
  const [tipoOperacion, setTipoOperacion] = useState('')
  const [contacto, setContacto] = useState('')
  const [guardando, setGuardando] = useState(false)

  if (profile !== null && profile.rol !== 'auditor' && profile.rol !== 'super_admin') {
    return <Navigate to="/" replace />
  }

  async function handleCrear() {
    if (!nombre.trim()) { toast.warning('El nombre es obligatorio'); return }

    setGuardando(true)
    try {
      const { data, error } = await tbl('aud_instalaciones')
        .insert({
          auditor_profile_id: profile!.id,
          certificadora_org_id: profile!.org_id,
          nombre: nombre.trim(),
          ubicacion: ubicacion.trim() || null,
          cultivo_producto: cultivoProducto.trim() || null,
          tipo_operacion: tipoOperacion.trim() || null,
          contacto: contacto.trim() || null,
        })
        .select('id')
        .single()
      if (error) throw error
      toast.success('Instalación creada')
      navigate(`/auditor/instalacion/${(data as { id: string }).id}`, { replace: true })
    } catch (e: unknown) {
      console.error('[AuditorNuevaInstalacion]', e)
      toast.error('No se pudo crear la instalación. Reintenta.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Nueva instalación</h2>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Para auditar sin cuenta M.A.D.Y</p>
        </div>
        <button onClick={onClose} aria-label="Cerrar" className="relative before:absolute before:content-[''] before:-inset-3"><X aria-hidden="true" className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 flex flex-col gap-5">
    <Campo etiqueta="Nombre" requerido className="gap-1.5">
      {({ id }) => (
        <input id={id}
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Nombre de la instalación"
          style={inputSt}
          autoFocus
        />
      )}
    </Campo>

    <Campo etiqueta="Ubicación" className="gap-1.5">
      {({ id }) => (
        <input id={id}
          type="text"
          value={ubicacion}
          onChange={e => setUbicacion(e.target.value)}
          placeholder="Ciudad, estado o dirección"
          style={inputSt}
        />
      )}
    </Campo>

    <Campo etiqueta="Cultivo / Producto" className="gap-1.5">
      {({ id }) => (
        <input id={id}
          type="text"
          value={cultivoProducto}
          onChange={e => setCultivoProducto(e.target.value)}
          placeholder="Ej. Tomate, Zarzamora, Carne bovina…"
          style={inputSt}
        />
      )}
    </Campo>

    <Campo etiqueta="Tipo de operación" className="gap-1.5">
      {({ id }) => (
        <input id={id}
          type="text"
          value={tipoOperacion}
          onChange={e => setTipoOperacion(e.target.value)}
          placeholder="Ej. Granja, Invernadero, Empaque, Cuarto Frío…"
          style={inputSt}
        />
      )}
    </Campo>

    <Campo etiqueta="Contacto (opcional)" className="gap-1.5">
      {({ id }) => (
        <input id={id}
          type="text"
          value={contacto}
          onChange={e => setContacto(e.target.value)}
          placeholder="Nombre o teléfono del responsable"
          style={inputSt}
        />
      )}
    </Campo>

      </div>

      <div className="px-4 pt-3 pb-4 border-t border-border flex-shrink-0">
        <Boton onClick={handleCrear} cargando={guardando} className="w-full">
          {guardando ? 'Guardando…' : 'Crear instalación'}
        </Boton>
      </div>
    </>
  )
}
