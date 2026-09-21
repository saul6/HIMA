import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

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
  outline: 'none',
}

export function AuditorNuevaInstalacion() {
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
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b border-border flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate('/auditor')} className="text-muted-foreground flex-shrink-0">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            Nueva instalación
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Para auditar sin cuenta M.A.D.Y
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 flex flex-col gap-5 max-w-lg mx-auto w-full pb-10">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
            Nombre *
          </label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Nombre de la instalación"
            style={inputSt}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
            Ubicación
          </label>
          <input
            type="text"
            value={ubicacion}
            onChange={e => setUbicacion(e.target.value)}
            placeholder="Ciudad, estado o dirección"
            style={inputSt}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
            Cultivo / Producto
          </label>
          <input
            type="text"
            value={cultivoProducto}
            onChange={e => setCultivoProducto(e.target.value)}
            placeholder="Ej. Tomate, Zarzamora, Carne bovina…"
            style={inputSt}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
            Tipo de operación
          </label>
          <input
            type="text"
            value={tipoOperacion}
            onChange={e => setTipoOperacion(e.target.value)}
            placeholder="Ej. Granja, Invernadero, Empaque, Cuarto Frío…"
            style={inputSt}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
            Contacto (opcional)
          </label>
          <input
            type="text"
            value={contacto}
            onChange={e => setContacto(e.target.value)}
            placeholder="Nombre o teléfono del responsable"
            style={inputSt}
          />
        </div>

        <button
          onClick={handleCrear}
          disabled={guardando}
          className="w-full h-11 rounded-xl text-sm font-semibold mt-2 disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
        >
          {guardando ? 'Guardando…' : 'Crear instalación'}
        </button>
      </main>
    </div>
  )
}
