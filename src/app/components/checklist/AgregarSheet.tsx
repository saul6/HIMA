import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Input } from '@/app/components/ui/input'
import { Pildora } from './Pildora'
import { SelectorResponsable } from './ItemDetalleSheet'
import { useColaboradoresChk } from './useColaboradores'
import { FRECUENCIAS, type ChkFrecuencia, type useChecklist } from '@/hooks/useChecklist'
import { Boton } from '@/app/components/ui-mady/Boton'

interface Props {
  open: boolean
  ranchoId: string
  hook: ReturnType<typeof useChecklist>
  onClose: () => void
  onGuardado: () => void
}

export function AgregarSheet({ open, ...resto }: Props) {
  return (
    <BottomSheet open={open} onClose={resto.onClose} height="85%" title="Agregar al checklist">
      {open && <Formulario {...resto} />}
    </BottomSheet>
  )
}

function Formulario({ ranchoId, hook, onClose, onGuardado }: Omit<Props, 'open'>) {
  const { colaboradores } = useColaboradoresChk(true)
  const [tipo, setTipo] = useState<'formato' | 'documento'>('formato')
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [area, setArea] = useState('')
  const [respTexto, setRespTexto] = useState('')
  const [respId, setRespId] = useState('')
  const [frecuencia, setFrecuencia] = useState<ChkFrecuencia>('diaria')
  const [vence, setVence] = useState('')
  const [guardando, setGuardando] = useState(false)
  const enviado = useRef(false)

  async function guardar() {
    if (guardando || enviado.current) return
    if (!nombre.trim()) { toast.warning('El nombre es obligatorio'); return }
    if (tipo === 'documento' && !vence) { toast.warning('Indica la fecha de vencimiento'); return }
    setGuardando(true)
    const datos: Record<string, unknown> = {
      tipo,
      nombre: nombre.trim(),
      codigo_formato: codigo.trim() || null,
      area: area.trim() || null,
      responsable_texto: respId ? null : (respTexto.trim() || null),
      responsable_profile_id: respId || null,
    }
    if (tipo === 'formato') datos.frecuencia = frecuencia
    else datos.vence_el = vence
    const res = await hook.itemGuardar(ranchoId, datos)
    setGuardando(false)
    if (!res.ok) { toast.error(res.mensaje ?? 'No se pudo agregar'); return }
    enviado.current = true
    toast.success(tipo === 'formato' ? 'Formato agregado' : 'Documento agregado')
    onGuardado()
    onClose()
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <Pildora activa={tipo === 'formato'} onClick={() => setTipo('formato')}>Formato fuera de la app</Pildora>
        <Pildora activa={tipo === 'documento'} onClick={() => setTipo('documento')}>Documento con vigencia</Pildora>
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Nombre</span>
        <Input
          value={nombre}
          maxLength={150}
          onChange={e => setNombre(e.target.value)}
          placeholder={tipo === 'formato' ? 'Registro y control de llaves' : 'Licencia, certificado…'}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Código del formato (opcional)</span>
        <Input value={codigo} maxLength={150} onChange={e => setCodigo(e.target.value)} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Área (opcional)</span>
        <Input value={area} maxLength={150} onChange={e => setArea(e.target.value)} />
      </label>
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Responsable (opcional)</span>
        <SelectorResponsable colaboradores={colaboradores} profileId={respId} texto={respTexto} onProfile={setRespId} onTexto={setRespTexto} />
      </div>
      {tipo === 'formato' ? (
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground">Frecuencia esperada</span>
          <div className="flex flex-wrap gap-2">
            {FRECUENCIAS.map(f => (
              <Pildora key={f.value} activa={frecuencia === f.value} onClick={() => setFrecuencia(f.value)}>{f.label}</Pildora>
            ))}
          </div>
        </div>
      ) : (
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Vence el</span>
          <Input type="date" value={vence} onChange={e => setVence(e.target.value)} />
        </label>
      )}
      <Boton type="button" onClick={guardar} disabled={guardando} className="w-full">
        {guardando ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Agregar'}
      </Boton>
    </div>
  )
}
