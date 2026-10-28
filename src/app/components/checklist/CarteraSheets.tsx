import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Input } from '@/app/components/ui/input'
import { Pildora } from './Pildora'
import { CLASE_INPUT, CLASE_TEXTAREA, PieFormulario } from './comun'
import { resolverIcono } from '@/app/components/iconos-modulos'
import { chk, mensajeError, useAccion, type CarteraCliente, type CarteraInstalacion, type ChkSector } from '@/hooks/useChecklistV2'

// ── Cliente ──────────────────────────────────────────────────────────────────

interface ClienteProps {
  open: boolean
  cliente: CarteraCliente | null
  onClose: () => void
  onGuardado: () => void
}

export function ClienteSheet({ open, ...resto }: ClienteProps) {
  return (
    <BottomSheet open={open} onClose={resto.onClose} height="85%" title={resto.cliente ? 'Editar cliente' : 'Nuevo cliente'}>
      {open && <FormCliente {...resto} />}
    </BottomSheet>
  )
}

function FormCliente({ cliente, onClose, onGuardado }: Omit<ClienteProps, 'open'>) {
  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [contacto, setContacto] = useState(cliente?.contacto ?? '')
  const [notas, setNotas] = useState(cliente?.notas ?? '')
  const [activo, setActivo] = useState(cliente?.activo ?? true)
  const [orgId, setOrgId] = useState<string | null>(cliente?.linked_org_id ?? null)
  const [orgNombre, setOrgNombre] = useState<string | null>(cliente?.linked_org_nombre ?? null)
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<{ id: string; nombre: string }[]>([])
  const { ocupado, ejecutar } = useAccion()

  // Buscador de organización M.A.D.Y: nunca se liga por nombre, solo eligiendo un resultado
  useEffect(() => {
    if (busca.trim().length < 3) { setResultados([]); return }
    let vivo = true
    const t = setTimeout(() => {
      chk.buscarOrganizaciones(busca).then(r => { if (vivo) setResultados(r ?? []) }).catch(e => { console.error(e); if (vivo) setResultados([]) })
    }, 300)
    return () => { vivo = false; clearTimeout(t) }
  }, [busca])

  async function guardar() {
    if (!nombre.trim()) { toast.warning('El nombre es obligatorio'); return }
    const r = await ejecutar(() => chk.clienteGuardar({
      id: cliente?.id, nombre: nombre.trim(), linked_org: orgId,
      contacto: contacto.trim() || null, notas: notas.trim() || null, activo,
    }))
    if (!r.ok) { toast.error(r.mensaje); return }
    toast.success(cliente ? 'Cliente actualizado' : 'Cliente creado')
    onGuardado()
    onClose()
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Nombre</span>
          <Input value={nombre} maxLength={200} onChange={e => setNombre(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Contacto (opcional)</span>
          <Input value={contacto} maxLength={300} onChange={e => setContacto(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Notas (opcional)</span>
          <textarea className={CLASE_TEXTAREA} value={notas} maxLength={2000} onChange={e => setNotas(e.target.value)} />
        </label>

        <div className="space-y-2">
          <span className="text-xs text-muted-foreground">Organización M.A.D.Y del cliente (opcional)</span>
          <p className="text-xs text-muted-foreground">
            Si el cliente usa M.A.D.Y, su administrador verá aquí las visitas cerradas y podrá reportar correcciones.
          </p>
          {orgId ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
              <span className="text-sm font-semibold">{orgNombre ?? 'Organización ligada'}</span>
              <button type="button" aria-label="Quitar organización" onClick={() => { setOrgId(null); setOrgNombre(null) }} className="p-1 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Escribe al menos 3 letras para buscar" />
              {resultados.length > 0 && (
                <ul className="rounded-lg border border-border bg-card divide-y divide-border">
                  {resultados.map(o => (
                    <li key={o.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                        onClick={() => { setOrgId(o.id); setOrgNombre(o.nombre); setBusca(''); setResultados([]) }}
                      >
                        {o.nombre}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {cliente && (
          <div className="flex gap-2">
            <Pildora activa={activo} onClick={() => setActivo(true)}>Activo</Pildora>
            <Pildora activa={!activo} onClick={() => setActivo(false)}>Inactivo</Pildora>
          </div>
        )}
      </div>
      <PieFormulario onCancelar={onClose} onGuardar={guardar} textoGuardar="Guardar" cargando={ocupado} />
    </>
  )
}

// ── Instalación ──────────────────────────────────────────────────────────────

interface InstalacionProps {
  open: boolean
  cliente: CarteraCliente | null
  instalacion: CarteraInstalacion | null
  onClose: () => void
  onGuardado: () => void
  /** Solo al crear: id de la instalación nueva, para abrir su catálogo. */
  onCreada?: (instalacionId: string) => void
}

export function InstalacionSheet({ open, ...resto }: InstalacionProps) {
  return (
    <BottomSheet open={open} onClose={resto.onClose} height="85%" title={resto.instalacion ? 'Editar instalación' : 'Nueva instalación'}>
      {open && resto.cliente && <FormInstalacion {...resto} cliente={resto.cliente} />}
    </BottomSheet>
  )
}

function FormInstalacion({ cliente, instalacion, onClose, onGuardado, onCreada }: Omit<InstalacionProps, 'open' | 'cliente'> & { cliente: CarteraCliente }) {
  const [nombre, setNombre] = useState(instalacion?.nombre ?? '')
  const [sector, setSector] = useState(instalacion?.sector_clave ?? '')
  const [sectores, setSectores] = useState<ChkSector[]>([])
  const [ubicacion, setUbicacion] = useState(instalacion?.ubicacion ?? '')
  const [rancho, setRancho] = useState(instalacion?.linked_rancho_id ?? '')
  const [umbral, setUmbral] = useState(String(instalacion?.umbral_vigencia_dias ?? 30))
  const [activo, setActivo] = useState(instalacion?.activo ?? true)
  const [sitios, setSitios] = useState<{ id: string; nombre: string; org: string }[]>([])
  const { ocupado, ejecutar } = useAccion()
  const cargado = useRef(false)

  useEffect(() => {
    if (cargado.current) return
    cargado.current = true
    chk.sitiosCliente(cliente.id).then(s => setSitios(s ?? [])).catch(e => toast.error(mensajeError(e)))
    chk.sectores().then(s => setSectores(s ?? [])).catch(e => toast.error(mensajeError(e)))
  }, [cliente.id])

  async function guardar() {
    if (!nombre.trim()) { toast.warning('El nombre es obligatorio'); return }
    if (!instalacion && !sector) { toast.warning('Elige el tipo de instalación'); return }
    const dias = Number(umbral)
    if (!Number.isInteger(dias) || dias < 1 || dias > 365) { toast.warning('El umbral de vigencia son días (1 a 365)'); return }
    const elegido = sectores.find(s => s.clave === sector)
    const r = await ejecutar(() => chk.instalacionGuardar({
      id: instalacion?.id, cliente: cliente.id, nombre: nombre.trim(),
      tipo: elegido?.nombre ?? instalacion?.tipo ?? null, sector: sector || null,
      ubicacion: ubicacion.trim() || null, linked_rancho: rancho || null,
      comparte_datos: instalacion?.comparte_datos ?? false, umbral: dias, activo,
    }))
    if (!r.ok) { toast.error(r.mensaje); return }
    if (instalacion) {
      toast.success('Instalación actualizada')
    } else {
      // La BD precarga los módulos del sector al crear: se cuenta lo cargado para avisar
      let cargados = 0
      try { cargados = (await chk.catalogoVer(r.data)).documentos.filter(d => d.activo).length } catch { /* el aviso es informativo */ }
      toast.success(cargados > 0 ? `Instalación creada · ${cargados} documentos cargados` : 'Instalación creada')
      onCreada?.(r.data)
    }
    onGuardado()
    onClose()
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <p className="text-xs text-muted-foreground">Cliente: <span className="font-semibold text-foreground">{cliente.nombre}</span></p>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Nombre</span>
          <Input value={nombre} maxLength={200} onChange={e => setNombre(e.target.value)} />
        </label>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Tipo de instalación{instalacion ? '' : ' *'}</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de instalación">
            {sectores.map(s => {
              const Icono = resolverIcono(s.icono)
              const activa = sector === s.clave
              return (
                <button
                  key={s.clave} type="button" role="radio" aria-checked={activa} onClick={() => setSector(s.clave)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm min-h-11 ${activa ? 'border-primary bg-muted font-semibold text-foreground' : 'border-border-control bg-card text-muted-foreground'}`}
                >
                  <Icono className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate">{s.nombre}</span>
                </button>
              )
            })}
          </div>
          {!instalacion && <p className="text-xs text-muted-foreground">Al crearla se cargan los módulos de este tipo de instalación. Podrás quitar los que no apliquen.</p>}
        </div>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Ubicación (opcional)</span>
          <Input value={ubicacion} maxLength={300} onChange={e => setUbicacion(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Sitio ligado en M.A.D.Y (opcional)</span>
          <select className={CLASE_INPUT} value={rancho} onChange={e => setRancho(e.target.value)}>
            <option value="">Sin ligar</option>
            {sitios.map(s => <option key={s.id} value={s.id}>{s.nombre}{s.org === 'cliente' ? ' (del cliente)' : ''}</option>)}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Avisar de vencimiento con (días)</span>
          <Input type="number" inputMode="numeric" min={1} max={365} value={umbral} onChange={e => setUmbral(e.target.value)} />
        </label>
        {instalacion && (
          <div className="flex gap-2">
            <Pildora activa={activo} onClick={() => setActivo(true)}>Activa</Pildora>
            <Pildora activa={!activo} onClick={() => setActivo(false)}>Inactiva</Pildora>
          </div>
        )}
      </div>
      <PieFormulario onCancelar={onClose} onGuardar={guardar} textoGuardar="Guardar" cargando={ocupado} />
    </>
  )
}
