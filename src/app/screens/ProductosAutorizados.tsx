import { useState } from 'react'
import { ChevronLeft, ListChecks, FileDown, Plus, X, Loader2, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { BottomSheet } from '@/app/components/BottomSheet'
import { useAuthContext } from '@/context/AuthContext'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { useM66ProductosAutorizados } from '@/hooks/useM66ProductosAutorizados'
import { supabase } from '@/lib/supabase'
import { generarProductosAutorizadosPDF } from '@/lib/pdf/m66/generarProductosAutorizadosPDF'

type FormState = {
  cultivo: string
  ingrediente_activo: string
  nombre_comercial: string
  concentracion: string
  empresa: string
  dosis_ha: string
  intervalo_seguridad_dias: string
  plagas_control: string
  mercado: string
}

const FORM_VACIO: FormState = {
  cultivo: '',
  ingrediente_activo: '',
  nombre_comercial: '',
  concentracion: '',
  empresa: '',
  dosis_ha: '',
  intervalo_seguridad_dias: '',
  plagas_control: '',
  mercado: '',
}

export function ProductosAutorizados() {
  const navigate = useNavigate()
  const { profile, user, codigoClave } = useAuthContext()
  const orgId = profile?.org_id ?? null
  const esAdmin = profile?.rol === 'admin_org' || profile?.rol === 'super_admin'
  const orgNombre = useOrganizacion(orgId)
  const { productos, loading, error, refetch } = useM66ProductosAutorizados(orgId)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [cultivoFiltro, setCultivoFiltro] = useState<string | null>(null)
  const [mercadoFiltro, setMercadoFiltro] = useState<string>('')
  const [soloActivos, setSoloActivos] = useState(true)

  const cultivosUnicos = [...new Set(productos.map(p => p.cultivo))].sort()
  const mercadosUnicos = [...new Set(productos.map(p => p.mercado).filter(Boolean))].sort()

  const productosFiltrados = productos.filter(p => {
    if (soloActivos && !p.activo) return false
    if (cultivoFiltro && p.cultivo !== cultivoFiltro) return false
    if (mercadoFiltro && p.mercado !== mercadoFiltro) return false
    return true
  })

  function abrirNuevo() {
    setEditId(null)
    setForm(FORM_VACIO)
    setSheetOpen(true)
  }

  function abrirEdicion(p: typeof productos[number]) {
    setEditId(p.id)
    setForm({
      cultivo: p.cultivo,
      ingrediente_activo: p.ingrediente_activo,
      nombre_comercial: p.nombre_comercial,
      concentracion: p.concentracion,
      empresa: p.empresa,
      dosis_ha: p.dosis_ha,
      intervalo_seguridad_dias: p.intervalo_seguridad_dias != null ? String(p.intervalo_seguridad_dias) : '',
      plagas_control: p.plagas_control,
      mercado: p.mercado,
    })
    setSheetOpen(true)
  }

  async function guardar() {
    if (!orgId) return
    if (!form.cultivo.trim()) { toast.error('El cultivo es requerido'); return }
    if (!form.ingrediente_activo.trim()) { toast.error('El ingrediente activo es requerido'); return }
    if (!form.nombre_comercial.trim()) { toast.error('El nombre comercial es requerido'); return }

    setGuardando(true)
    try {
      const payload = {
        cultivo: form.cultivo.trim(),
        ingrediente_activo: form.ingrediente_activo.trim(),
        nombre_comercial: form.nombre_comercial.trim(),
        concentracion: form.concentracion.trim(),
        empresa: form.empresa.trim(),
        dosis_ha: form.dosis_ha.trim(),
        intervalo_seguridad_dias: form.intervalo_seguridad_dias ? parseInt(form.intervalo_seguridad_dias) : null,
        plagas_control: form.plagas_control.trim(),
        mercado: form.mercado.trim(),
      }

      if (editId === null) {
        const { error: err } = await (supabase as any)
          .from('m66_productos_autorizados')
          .insert({ org_id: orgId, ...payload, creado_por: user?.id })
        if (err) throw err
        toast.success('Producto agregado')
      } else {
        const { error: err } = await (supabase as any)
          .from('m66_productos_autorizados')
          .update(payload)
          .eq('id', editId)
        if (err) throw err
        toast.success('Producto actualizado')
      }
      setSheetOpen(false)
      await refetch()
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function desactivar() {
    if (!editId) return
    setGuardando(true)
    try {
      const { error: err } = await (supabase as any)
        .from('m66_productos_autorizados')
        .update({ activo: false })
        .eq('id', editId)
      if (err) throw err
      toast.success('Producto desactivado')
      setSheetOpen(false)
      await refetch()
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al desactivar')
    } finally {
      setGuardando(false)
    }
  }

  async function exportarPDF() {
    if (!orgId) return
    setPdfLoading(true)
    try {
      await generarProductosAutorizadosPDF(orgId, orgNombre ?? '', codigoClave, cultivoFiltro)
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al generar PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-tight">Lista de Productos Autorizados</h1>
          <p className="text-xs text-muted-foreground">M66 · Org-level</p>
        </div>
        <button
          onClick={exportarPDF}
          disabled={pdfLoading}
          className="p-2 rounded-lg border border-border"
        >
          {pdfLoading
            ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--primary)' }} />
            : <FileDown className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          }
        </button>
        <ListChecks className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* Filtros */}
      <div className="px-4 mb-3 space-y-3">
        {/* Filtro por cultivo */}
        {cultivosUnicos.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCultivoFiltro(null)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
              style={cultivoFiltro === null
                ? { backgroundColor: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }
                : { backgroundColor: 'var(--input-background)', color: 'var(--muted-foreground)', borderColor: 'var(--border)' }
              }
            >
              Todos
            </button>
            {cultivosUnicos.map(c => (
              <button
                key={c}
                onClick={() => setCultivoFiltro(c)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
                style={cultivoFiltro === c
                  ? { backgroundColor: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }
                  : { backgroundColor: 'var(--input-background)', color: 'var(--muted-foreground)', borderColor: 'var(--border)' }
                }
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Filtros secundarios */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSoloActivos(v => !v)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
            style={soloActivos
              ? { backgroundColor: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }
              : { backgroundColor: 'var(--input-background)', color: 'var(--muted-foreground)', borderColor: 'var(--border)' }
            }
          >
            Solo activos
          </button>

          {mercadosUnicos.length > 0 && (
            <select
              className="h-8 rounded-lg border border-border bg-input-background px-2 text-xs text-muted-foreground"
              value={mercadoFiltro}
              onChange={e => setMercadoFiltro(e.target.value)}
            >
              <option value="">Todos los mercados</option>
              {mercadosUnicos.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 px-4 pb-32 space-y-2 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--agro-danger-text)' }}>{error}</p>
        )}
        {!loading && !error && productosFiltrados.length === 0 && (
          <p className="text-center py-12 text-muted-foreground text-sm">
            Sin productos{cultivoFiltro ? ` para ${cultivoFiltro}` : ''}.
          </p>
        )}
        {productosFiltrados.map(p => (
          <div key={p.id} className="bg-card border border-border rounded-[0.625rem] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="text-sm font-semibold leading-snug">{p.nombre_comercial}</p>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
                  >
                    {p.cultivo}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{p.ingrediente_activo}{p.concentracion ? ` · ${p.concentracion}` : ''}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.empresa}</p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {p.dosis_ha && (
                    <span className="text-xs text-muted-foreground">Dosis: {p.dosis_ha}</span>
                  )}
                  {p.intervalo_seguridad_dias != null && (
                    <span
                      className="text-xs px-2 py-0.5 rounded font-medium"
                      style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
                    >
                      I.S. {p.intervalo_seguridad_dias} dias
                    </span>
                  )}
                  {p.mercado && (
                    <span className="text-xs text-muted-foreground">{p.mercado}</span>
                  )}
                </div>
                {p.plagas_control && (
                  <p className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2">{p.plagas_control}</p>
                )}
                {!p.activo && (
                  <span className="mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                    Inactivo
                  </span>
                )}
              </div>
              {esAdmin && (
                <button
                  onClick={() => abrirEdicion(p)}
                  className="p-1.5 rounded-lg border border-border shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* FAB — solo admin */}
      {esAdmin && (
        <div className="fixed bottom-20 right-4 z-50">
          <button
            onClick={abrirNuevo}
            className="w-14 h-14 rounded-full text-white flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: 'var(--primary)' }}
            aria-label="Nuevo producto"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Bottom sheet — Formulario */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} height="85%">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold">
            {editId ? 'Editar producto' : 'Nuevo producto autorizado'}
          </h2>
          <button onClick={() => setSheetOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 pt-4 pb-8 space-y-4">

          <div>
            <label className="block text-xs font-medium mb-1">Cultivo</label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Ej. Zarzamora, Aguacate..."
              value={form.cultivo}
              onChange={e => setForm(f => ({ ...f, cultivo: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Ingrediente activo</label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Ej. Clorpirifos, Imidacloprid..."
              value={form.ingrediente_activo}
              onChange={e => setForm(f => ({ ...f, ingrediente_activo: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Nombre comercial</label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Nombre del producto"
              value={form.nombre_comercial}
              onChange={e => setForm(f => ({ ...f, nombre_comercial: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Concentracion</label>
              <input
                type="text"
                className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                placeholder="Ej. 480 g/L"
                value={form.concentracion}
                onChange={e => setForm(f => ({ ...f, concentracion: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Dosis/ha</label>
              <input
                type="text"
                className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                placeholder="Ej. 1.5 L/ha"
                value={form.dosis_ha}
                onChange={e => setForm(f => ({ ...f, dosis_ha: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Empresa / Fabricante</label>
            <input
              type="text"
              className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
              placeholder="Nombre del fabricante"
              value={form.empresa}
              onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                Intervalo de seguridad (dias)
              </label>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                placeholder="Ej. 14"
                value={form.intervalo_seguridad_dias}
                onChange={e => setForm(f => ({ ...f, intervalo_seguridad_dias: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Mercado objetivo</label>
              <input
                type="text"
                className="w-full h-10 rounded-[0.625rem] border border-border bg-input-background px-3 text-sm"
                placeholder="Ej. USA, Mexico, UE..."
                value={form.mercado}
                onChange={e => setForm(f => ({ ...f, mercado: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Plagas que controla</label>
            <textarea
              rows={3}
              className="w-full rounded-[0.625rem] border border-border bg-input-background px-3 py-2 text-sm resize-none"
              placeholder="Descripcion de plagas o enfermedades que controla"
              value={form.plagas_control}
              onChange={e => setForm(f => ({ ...f, plagas_control: e.target.value }))}
            />
          </div>

          {editId && (
            <button
              type="button"
              onClick={desactivar}
              disabled={guardando}
              className="w-full h-10 rounded-[0.625rem] border text-sm font-medium disabled:opacity-50"
              style={{ borderColor: 'var(--agro-danger-text)', color: 'var(--agro-danger-text)' }}
            >
              Desactivar producto
            </button>
          )}
        </div>
        <div className="px-4 pb-6 pt-3 border-t border-border">
          <button
            onClick={guardar}
            disabled={guardando}
            className="w-full h-11 rounded-[0.625rem] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
